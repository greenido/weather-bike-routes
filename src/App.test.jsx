// @vitest-environment happy-dom
/*
  End-to-end checks of the app in a simulated browser: upload routes, get forecasts, rank, select, errors, Help,
  and the guided tour. The real analysis, scoring, and weather code run; only these are replaced:
  - the network (`fetch`), with forecasts that are 18°C below latitude 46 and 33°C above it;
  - GPX parsing (covered by gpxParser.test.js; gpxparser can't load in a DOM test environment);
  - the Leaflet map, which needs a real layout engine.
*/
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App.jsx'
import { TOUR_STORAGE_KEY } from './components/GuidedTour.jsx'
import { parseGpxFile } from './services/gpxParser'
import { makeRoute } from './test/fixtures'

vi.mock('./services/gpxParser', () => ({ parseGpxFile: vi.fn() }))
vi.mock('./components/MapPreview.jsx', () => ({ default: () => null }))

const ROUTES = {
  'river-loop.gpx': makeRoute({ lat: 45 }),
  'hill-climb.gpx': makeRoute({ lat: 46.5 }),
}
const HOT_LATITUDE = 46

const jsonResponse = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) })
const tempAt = (lat) => (lat >= HOT_LATITUDE ? 33 : 18)

function openMeteoForecast(url) {
  const params = new URL(url).searchParams
  const from = Date.parse(`${params.get('start_date')}T00:00:00Z`) / 1000
  const to = Date.parse(`${params.get('end_date')}T23:00:00Z`) / 1000
  const time = []
  for (let t = from; t <= to; t += 3600) time.push(t)
  const column = (value) => time.map(() => value)
  return params.get('latitude').split(',').map((lat) => ({
    hourly: {
      time,
      temperature_2m: column(tempAt(Number(lat))),
      apparent_temperature: column(tempAt(Number(lat))),
      precipitation_probability: column(0),
      precipitation: column(0),
      wind_speed_10m: column(5),
      wind_direction_10m: column(0),
      wind_gusts_10m: column(10),
      visibility: column(20000),
    },
  }))
}

function visualCrossingForecast(url) {
  const segments = new URL(url).pathname.split('/')
  const lat = Number(segments.at(-3).split(',')[0])
  const [from, to] = segments.slice(-2).map(Number)
  const hours = []
  for (let t = from; t <= to; t += 3600) {
    hours.push({ datetimeEpoch: t, temp: tempAt(lat), feelslike: tempAt(lat), precipprob: 0, precip: 0, windspeed: 5, winddir: 0, windgust: 10, visibility: 20 })
  }
  return { days: [{ hours }] }
}

const forecast = async (url) => jsonResponse(url.includes('visualcrossing.com') ? visualCrossingForecast(url) : openMeteoForecast(url))
const gpxFile = (name) => new File(['<gpx></gpx>'], name, { type: 'application/gpx+xml' })
const fileInput = () => document.querySelector('input[type="file"]')
const cardLabels = () => screen.getAllByRole('button', { name: /out of 10$/ }).map((card) => card.getAttribute('aria-label'))
const tourStep = (title) => screen.findByRole('alertdialog', { name: title })
const tourEnded = () => waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
let fetchMock

async function renderWithRoutes(...names) {
  const user = userEvent.setup()
  render(<App />)
  await user.upload(fileInput(), names.map(gpxFile))
  return user
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(TOUR_STORAGE_KEY, 'done') // A returning visitor; the tour has its own tests below.
  fetchMock = vi.fn(forecast)
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  parseGpxFile.mockImplementation(async (file) => {
    if (!ROUTES[file.name]) throw new Error('No track or route points found')
    return ROUTES[file.name]
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('ranks routes by the weather along them and opens the best one', async () => {
    const user = await renderWithRoutes('hill-climb.gpx', 'river-loop.gpx')
    await screen.findAllByRole('button', { name: /out of 10$/ })
    expect(cardLabels()).toEqual(['river-loop.gpx, score 10.0 out of 10', 'hill-climb.gpx, score 8.0 out of 10'])
    // One Open-Meteo request per route.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.every(([url]) => url.startsWith('https://api.open-meteo.com/'))).toBe(true)

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('river-loop.gpx')
    expect(screen.getByText('Comfortable the whole way.')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /^hill-climb\.gpx/ }))
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('hill-climb.gpx')
    expect(screen.getByRole('button', { name: /^hill-climb\.gpx/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(/^Above 25°C from km 0 /)).toBeTruthy()
  })

  it('names the files it could not read and still scores the rest', async () => {
    await renderWithRoutes('river-loop.gpx', 'broken.gpx')
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't read broken.gpx (No track or route points found).")
    expect(await screen.findByRole('button', { name: 'river-loop.gpx, score 10.0 out of 10' })).toBeTruthy()
  })

  it('explains when the forecast cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await renderWithRoutes('river-loop.gpx')
    expect((await screen.findByRole('alert')).textContent).toBe("Couldn't reach Open-Meteo. Check your connection and try again.")
    expect(screen.getByRole('button', { name: 'river-loop.gpx, no forecast' })).toBeTruthy()
  })

  it('refuses start times beyond the forecast range', async () => {
    await renderWithRoutes('river-loop.gpx')
    await screen.findByRole('button', { name: /out of 10$/ })
    const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const pad = (n) => String(n).padStart(2, '0')
    fireEvent.change(screen.getByLabelText('Start date & time'), {
      target: { value: `${later.getFullYear()}-${pad(later.getMonth() + 1)}-${pad(later.getDate())}T09:00` },
    })
    expect((await screen.findByRole('alert')).textContent).toBe('Forecasts only reach 15 days ahead. Pick an earlier start time.')
    expect(screen.getByRole('button', { name: 'river-loop.gpx, no forecast' })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('recalculates once after a burst of speed changes', async () => {
    await renderWithRoutes('river-loop.gpx')
    await screen.findByRole('button', { name: /out of 10$/ })
    const speed = screen.getByRole('slider')
    // Drag the slider: three changes 100 ms apart, each sooner than the 350 ms pause before recalculating.
    for (const value of [25, 28, 31]) {
      fireEvent.change(speed, { target: { value } })
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    expect(screen.getByText('Average speed: 31 km/h')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await new Promise((resolve) => setTimeout(resolve, 500))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('uses Visual Crossing, one point at a time, once a key is saved in Settings', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.type(screen.getByLabelText('Visual Crossing API key (optional)'), 'test-key')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem('visualCrossingApiKey')).toBe('test-key')

    await user.upload(fileInput(), gpxFile('river-loop.gpx'))
    await screen.findByRole('button', { name: 'river-loop.gpx, score 10.0 out of 10' })
    // The route has three forecast points: one Visual Crossing request each, and none to Open-Meteo.
    expect(fetchMock.mock.calls.map(([url]) => new URL(url).host)).toEqual(Array(3).fill('weather.visualcrossing.com'))
  })

  it('explains the app in Help and replays the tour from there', async () => {
    const user = await renderWithRoutes('river-loop.gpx')
    await screen.findByRole('button', { name: /out of 10$/ })
    await user.click(screen.getByRole('button', { name: 'Help' }))
    const help = screen.getByRole('dialog', { name: 'Help' })
    expect(within(help).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'How to use it', 'Reading a route', 'How the score works', 'Where the forecast comes from', 'Your privacy',
    ])
    expect(within(help).getByRole('list', { name: 'Temperature colors' })).toBeTruthy()

    await user.click(within(help).getByRole('button', { name: 'Take the tour' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    await tourStep('Welcome to Bike Route Weather')
    // A route is scored, so the replay includes the route steps: 4 setup + 4 route + 2 top bar.
    await user.click(screen.getByRole('button', { name: 'Next (1 of 10)' }))
    await tourStep('When you set off')
    await user.click(screen.getByRole('button', { name: 'Skip tour' }))
    await tourEnded()
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done')
    // Focus goes back to where it was before the tour, like after a dialog.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Help' }))
  })
})

describe('Guided tour', () => {
  beforeEach(() => localStorage.removeItem(TOUR_STORAGE_KEY))

  async function clickThrough(user, titles) {
    for (const title of titles) {
      await user.click(screen.getByRole('button', { name: /^Next/ }))
      await tourStep(title)
    }
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await tourEnded()
  }

  it('walks a first-time visitor through the setup, then through their first scored route', async () => {
    const user = userEvent.setup()
    render(<App />)
    await tourStep('Welcome to Bike Route Weather')
    expect(screen.getByRole('button', { name: 'Next (1 of 6)' })).toBeTruthy()
    await clickThrough(user, ['When you set off', 'How fast you ride', 'Add your routes', 'Where the forecast comes from', 'Help, any time'])
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe('intro-done')

    await user.upload(fileInput(), gpxFile('river-loop.gpx'))
    await tourStep('Best route first')
    await clickThrough(user, ['What to wear or bring', 'Temperature along the route', 'Every point of the ride'])
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done')
  })

  it('stops for good when skipped', async () => {
    const user = userEvent.setup()
    render(<App />)
    await tourStep('Welcome to Bike Route Weather')
    await user.click(screen.getByRole('button', { name: 'Skip tour' }))
    await tourEnded()
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done')

    await user.upload(fileInput(), gpxFile('river-loop.gpx'))
    await screen.findByRole('button', { name: /out of 10$/ })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('ends on Escape', async () => {
    const user = userEvent.setup()
    render(<App />)
    await tourStep('Welcome to Bike Route Weather')
    await user.keyboard('{Escape}')
    await tourEnded()
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe('done')
  })
})
