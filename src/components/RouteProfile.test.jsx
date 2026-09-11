// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RouteProfile from './RouteProfile.jsx'
import { makeTimeline } from '../test/fixtures'

afterEach(cleanup)

// 10 km with a point every 250 m, warming from 12°C to 24°C, wind from the southeast.
const timeline = makeTimeline({ km: 10, points: 41 })
const sampleIdx = [0, 20, 40]

function ProfileExample({ onHover }) {
  const [hoverIndex, setHoverIndex] = useState(null)
  const hover = (index) => {
    onHover?.(index)
    setHoverIndex(index)
  }
  return <RouteProfile timeline={timeline} sampleIdx={sampleIdx} hoverIndex={hoverIndex} onHover={hover} />
}

describe('RouteProfile', () => {
  it('describes the temperature range for screen readers', () => {
    render(<ProfileExample />)
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('from 12°C to 24°C')
  })

  it('steps through the ride with the keyboard, 1 km at a time', async () => {
    const user = userEvent.setup()
    const onHover = vi.fn()
    render(<ProfileExample onHover={onHover} />)
    const kmOfLastHover = () => timeline[onHover.mock.lastCall[0]].km

    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('img'))
    expect(onHover).toHaveBeenLastCalledWith(0)
    await user.keyboard('{ArrowRight}')
    expect(kmOfLastHover()).toBeCloseTo(1)
    await user.keyboard('{End}')
    expect(onHover).toHaveBeenLastCalledWith(40)
    await user.keyboard('{ArrowLeft}')
    expect(kmOfLastHover()).toBeCloseTo(9)
    await user.keyboard('{Home}')
    expect(onHover).toHaveBeenLastCalledWith(0)
  })

  it('shows the conditions at the highlighted point', () => {
    render(<RouteProfile timeline={timeline} sampleIdx={sampleIdx} hoverIndex={20} onHover={() => {}} />)
    const tooltip = screen.getByText('feels like 17°').parentElement.parentElement
    expect(tooltip.textContent).toContain('18.0°C')
    expect(tooltip.textContent).toContain('km 5.0')
    expect(tooltip.textContent).toContain('300 m')
    expect(tooltip.textContent).toContain('Wind 9 km/h SE · rain 0%')
  })

  it('lists every forecast point in the table view', () => {
    render(<ProfileExample />)
    const rows = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', { hidden: true })
    expect(rows).toHaveLength(sampleIdx.length + 1)
    const firstCells = rows.slice(1).map((row) => row.querySelector('td').textContent)
    expect(firstCells).toEqual(['0.0', '5.0', '10.0'])
  })
})
