// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ScoreBreakdown from './ScoreBreakdown.jsx'

afterEach(cleanup)

describe('ScoreBreakdown', () => {
  it('labels every factor and shows penalties with a minus and bonuses with a plus', () => {
    render(<ScoreBreakdown breakdown={{ wind: -1.5, temperature: 1, rain: 0, visibility: 2 }} />)
    expect(screen.getByTitle('Wind').textContent).toBe('Wind+1.5')
    expect(screen.getByTitle('Temperature').textContent).toBe('Temperature-1.0')
    expect(screen.getByTitle('Rain').textContent).toBe('Rain0')
    expect(screen.getByTitle('Visibility').textContent).toBe('Visibility-2.0')
  })

  it('renders nothing without a breakdown', () => {
    const { container } = render(<ScoreBreakdown />)
    expect(container.innerHTML).toBe('')
  })
})
