import { describe, expect, it, vi } from 'vitest'
import { haversineKm } from './geo'
import { analyzeRoute, buildRouteTimeline, estimateArrivalTimes, forecastLeadDays, rideAdvice, summarizeRide } from './routeAnalysis'

const HOUR = 3600 * 1000
const START = Date.UTC(2026, 8, 12, 6)
const KM_PER_DEG_LAT = 111.195

const withKm = (points) => {
  let km = 0
  return points.map((p, i) => {
    if (i > 0) km += haversineKm(points[i - 1], p)
    return { ...p, km }
  })
}
const northward = (km, eleAt = () => 100, stepKm = 0.1) =>
  withKm(Array.from({ length: Math.round(km / stepKm) + 1 }, (_, i) => ({ lat: 45 + (i * stepKm) / KM_PER_DEG_LAT, lon: 7, ele: eleAt(i * stepKm) })))
const loop = (radiusKm, n = 400) =>
  withKm(Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    return { lat: 45 + (radiusKm / KM_PER_DEG_LAT) * Math.sin(a), lon: 7 + (radiusKm / (KM_PER_DEG_LAT * Math.cos((45 * Math.PI) / 180))) * Math.cos(a), ele: 100 }
  }))
const weather = (overrides = {}) => ({
  tempC: 18, feelsLikeC: 18, windKph: 0, windFromDeg: 0, gustKph: 0, rainChance: 0, visibilityKm: 20, ...overrides,
})
const flatTimeline = (points, overrides) => points.map((p, i) => ({ ...p, eta: START + i * 60000, ...weather(typeof overrides === 'function' ? overrides(p, i) : overrides) }))

describe('estimateArrivalTimes', () => {
  it('rides a flat route at the average speed', () => {
    const etas = estimateArrivalTimes(northward(72), START, 24)
    expect((etas.at(-1) - START) / HOUR).toBeCloseTo(3, 2)
  })

  it('adds time stopped, spread along the ride, without changing the start', () => {
    const points = northward(72)
    const moving = estimateArrivalTimes(points, START, 24)
    const withStops = estimateArrivalTimes(points, START, 24, 30 * 60 * 1000)

    expect(withStops[0]).toBe(START) // You have not stopped yet at the start line.
    expect((withStops.at(-1) - moving.at(-1)) / 60000).toBeCloseTo(30, 6) // All of it by the finish.
    const half = Math.round((points.length - 1) / 2)
    expect((withStops[half] - moving[half]) / 60000).toBeCloseTo(15, 1) // About half of it halfway round.
  })

  it('leaves the estimate untouched when no stops are expected', () => {
    const points = northward(30)
    expect(estimateArrivalTimes(points, START, 24, 0)).toEqual(estimateArrivalTimes(points, START, 24))
  })

  it('slows down on climbs and speeds up on descents', () => {
    const up = estimateArrivalTimes(northward(20, (km) => 100 + km * 50), START, 22).at(-1)
    const down = estimateArrivalTimes(northward(20, (km) => 1100 - km * 50), START, 22).at(-1)
    const flat = estimateArrivalTimes(northward(20), START, 22).at(-1)
    expect(up).toBeGreaterThan(flat)
    expect(down).toBeLessThan(flat)
  })

  it('never goes back in time and ignores missing elevation', () => {
    const points = northward(10).map((p, i) => ({ ...p, ele: i % 2 ? null : p.ele }))
    const etas = estimateArrivalTimes(points, START, 20)
    expect(etas.every((t, i) => i === 0 || t >= etas[i - 1])).toBe(true)
    expect((etas.at(-1) - START) / HOUR).toBeCloseTo(0.5, 2)
  })
})

describe('buildRouteTimeline', () => {
  const points = northward(10)
  const sampleIdx = [0, 100]
  const etas = points.map((_, i) => START + i * 60000)

  it('matches the forecast at sample points and interpolates by distance in between', () => {
    const timeline = buildRouteTimeline(points, sampleIdx, [weather({ tempC: 10 }), weather({ tempC: 20 })], etas)
    expect(timeline[0].tempC).toBeCloseTo(10)
    expect(timeline[50].tempC).toBeCloseTo(15)
    expect(timeline[100].tempC).toBeCloseTo(20)
    expect(timeline[50].eta).toBe(etas[50])
  })

  it('cools points that sit higher than the sampled forecasts', () => {
    const summit = points.map((p, i) => (i === 50 ? { ...p, ele: 1100 } : p))
    const timeline = buildRouteTimeline(summit, sampleIdx, [weather({ tempC: 15 }), weather({ tempC: 15 })], etas)
    expect(timeline[50].tempC).toBeCloseTo(15 - 6.5)
  })

  it('blends wind as a vector', () => {
    const timeline = buildRouteTimeline(points, sampleIdx, [weather({ windKph: 10, windFromDeg: 350 }), weather({ windKph: 10, windFromDeg: 10 })], etas)
    expect(Math.min(timeline[50].windFromDeg, 360 - timeline[50].windFromDeg)).toBeLessThan(0.01)
  })
})

const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length

describe('summarizeRide', () => {
  it('counts wind from the direction of travel as headwind', () => {
    const summary = summarizeRide(flatTimeline(northward(10), { windKph: 20, windFromDeg: 0 }))
    expect(summary.avgHeadwindKph).toBeCloseTo(20, 1)
    expect(summary.avgWindKph).toBeCloseTo(20, 6)
  })

  it('counts wind from behind as tailwind', () => {
    expect(summarizeRide(flatTimeline(northward(10), { windKph: 20, windFromDeg: 180 })).avgHeadwindKph).toBeCloseTo(-20, 1)
  })

  it('cancels headwind and tailwind out over a loop', () => {
    const summary = summarizeRide(flatTimeline(loop(5), { windKph: 20, windFromDeg: 270 }))
    expect(Math.abs(summary.avgHeadwindKph)).toBeLessThan(0.5)
    expect(summary.avgWindKph).toBeCloseTo(20, 6)
  })

  it('finds extremes, rain, and the share of the ride in the comfort band', () => {
    const points = northward(10)
    const summary = summarizeRide(flatTimeline(points, (p) => ({
      tempC: p.km < 5 ? 12 : 18,
      rainChance: Math.abs(p.km - 7) < 0.05 ? 60 : 10,
    })))
    expect(summary.coldestIndex).toBe(0)
    expect(points[summary.warmestIndex].km).toBeGreaterThanOrEqual(5)
    expect(summary.maxRainChance).toBe(60)
    expect(points[summary.rainIndex].km).toBeCloseTo(7, 1)
    expect(summary.comfortShare).toBeCloseTo(0.5, 1)
    expect(summary.feelsLikeC).toHaveLength(101)
  })

  it('resamples rain and gusts by distance so scoring weights every km the same', () => {
    // Rain only over the last km of ten: the peak is 60%, but almost none of the ride is wet.
    const summary = summarizeRide(flatTimeline(northward(10), (p) => ({
      rainChance: p.km > 9 ? 60 : 0,
      gustKph: p.km > 9 ? 70 : 5,
    })))
    expect(summary.rainChance).toHaveLength(101)
    expect(summary.gustKph).toHaveLength(101)
    expect(summary.maxRainChance).toBe(60)
    expect(summary.maxGustKph).toBe(70)
    expect(mean(summary.rainChance)).toBeLessThan(10)
    expect(mean(summary.gustKph)).toBeLessThan(15)
  })
})

describe('forecastLeadDays', () => {
  const now = Date.UTC(2026, 8, 12, 9)
  const inDays = (days) => forecastLeadDays(now + days * 24 * 60 * 60 * 1000, now)

  it('rounds to whole days and never goes negative', () => {
    expect([inDays(0), inDays(1.4), inDays(1.6), inDays(9)]).toEqual([0, 1, 2, 9])
    expect(inDays(-3)).toBe(0)
  })
})

describe('rideAdvice', () => {
  const formatTime = (ms) => new Date(ms).toISOString().slice(11, 16)
  const advise = (tempAt, rainChance = 0) => {
    const timeline = flatTimeline(northward(10), (p) => ({ tempC: tempAt(p.km), rainChance }))
    return rideAdvice(timeline, summarizeRide(timeline), formatTime)
  }

  it('suggests layers when the ride starts cold', () => {
    expect(advise((km) => (km < 3.95 ? 12 : 17))).toEqual(['Below 15°C until km 4 (06:40). Start with arm warmers.'])
  })

  it('warns about cold that comes later, heat, and rain', () => {
    expect(advise((km) => (km < 6 ? 18 : 12))[0]).toMatch(/^Drops below 15°C around km 6/)
    expect(advise(() => 27)[0]).toBe('Above 25°C from km 0 (06:00). Carry extra water.')
    expect(advise(() => 18, 45)).toEqual(['45% chance of rain around km 0 (06:00). Pack a rain jacket.'])
  })

  it('says so when the whole ride is comfortable', () => {
    expect(advise(() => 18)).toEqual(['Comfortable the whole way.'])
    expect(advise(() => 8)).toEqual(['Below 15°C the whole way. Dress for the cold.'])
  })
})

describe('analyzeRoute', () => {
  it('asks for forecasts at the samples for the ride window and scores the result', async () => {
    const points = northward(40)
    const route = { points, sampleIdx: [0, 200, 400] }
    const getForecasts = vi.fn(async (samples) => samples.map(() => ({
      times: [START - HOUR, START + 5 * HOUR],
      tempC: [18, 18], feelsLikeC: [18, 18], rainChance: [0, 0], precipMm: [0, 0],
      windKph: [5, 5], windFromDeg: [90, 90], gustKph: [10, 10], visibilityKm: [20, 20],
    })))
    const result = await analyzeRoute(route, { startMs: START, speedKph: 20, apiKey: '', getForecasts })

    const [samples, from, to] = getForecasts.mock.calls[0]
    expect(samples).toEqual([points[0], points[200], points[400]])
    expect(from).toBe(START)
    expect((to - START) / HOUR).toBeCloseTo(2, 2)
    expect(result.timeline).toHaveLength(points.length)
    expect(result.score).toBe(10)
    expect(result.summary.comfortShare).toBeCloseTo(1)
  })
})
