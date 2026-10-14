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

  it('removes a route without selecting it', async () => {
    const onRemove = vi.fn()
    const onSelect = vi.fn()
    render(<RouteList routes={[comfy, hot]} selectedId="a" onSelect={onSelect} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove desert-out-and-back.gpx' }))
    expect(onRemove).toHaveBeenCalledWith('b')
    expect(onSelect).not.toHaveBeenCalled()
  })
})
