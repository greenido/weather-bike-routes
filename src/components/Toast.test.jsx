// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import Toast from './Toast.jsx'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Toast', () => {
  it('shows the message, then hides itself', () => {
    vi.useFakeTimers()
    render(<Toast message="Using the backup forecast." durationMs={1000} />)
    expect(screen.getByRole('status').textContent).toBe('Using the backup forecast.')
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('closes right away from its button', () => {
    render(<Toast message="Using the backup forecast." />)
    act(() => screen.getByRole('button', { name: 'Dismiss' }).click())
    expect(screen.queryByRole('status')).toBeNull()
  })
})
