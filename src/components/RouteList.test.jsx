// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RouteList from './RouteList.jsx'
import { makeAnalyzedRoute } from '../test/fixtures'

afterEach(cleanup)

describe('RouteList', () => {
  const comfy = makeAnalyzedRoute({ id: 'a', name: 'river-loop.gpx', fromC: 16, toC: 20 })
  const hot = makeAnalyzedRoute({ id: 'b', name: 'desert-out-and-back.gpx', fromC: 30, toC: 36 })
  const describedText = (element) => element.getAttribute('aria-describedby').split(' ').map((id) => document.getElementById(id).textContent).join(' ')

  it('names each card by route and score, and describes it with the breakdown and ride summary', () => {
    render(<RouteList routes={[comfy, hot]} selectedId="a" onSelect={() => {}} />)
    const card = screen.getByRole('button', { name: `river-loop.gpx, score ${comfy.analysis.score.toFixed(1)} out of 10` })
    expect(card.getAttribute('aria-pressed')).toBe('true')
    const description = describedText(card)
    expect(description).toContain('Wind')
    expect(description).toContain('10 km')
    expect(description).toContain('16–20°C')
    expect(description).toContain('rain 0%')
  })

  it('keeps the order it is given and marks only the selected card', () => {
    render(<RouteList routes={[comfy, hot]} selectedId="b" onSelect={() => {}} />)
    const cards = screen.getAllByRole('button')
    expect(cards.map((card) => card.getAttribute('aria-label').split(',')[0])).toEqual(['river-loop.gpx', 'desert-out-and-back.gpx'])
    expect(cards.map((card) => card.getAttribute('aria-pressed'))).toEqual(['false', 'true'])
  })

  it('selects a route when its card is clicked', async () => {
    const onSelect = vi.fn()
    render(<RouteList routes={[comfy, hot]} selectedId="a" onSelect={onSelect} />)
    await userEvent.click(screen.getByRole('button', { name: /^desert-out-and-back\.gpx/ }))
    expect(onSelect).toHaveBeenCalledWith('b')
  })

  it('says when the forecast is loading or missing', () => {
    const noForecast = { ...comfy, analysis: undefined }
    const { rerender } = render(<RouteList routes={[noForecast]} isLoading />)
    expect(screen.getByRole('button', { name: 'river-loop.gpx, loading forecast' }).textContent).toContain('Loading…')
    rerender(<RouteList routes={[noForecast]} isLoading={false} />)
    expect(screen.getByRole('button', { name: 'river-loop.gpx, no forecast' }).textContent).toContain('No forecast')
  })

  it('renders nothing without routes', () => {
    const { container } = render(<RouteList routes={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
