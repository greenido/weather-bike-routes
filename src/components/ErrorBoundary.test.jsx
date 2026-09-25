// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary from './ErrorBoundary.jsx'

function Boom({ explode }) {
  if (explode) throw new Error('timeline went sideways')
  return <p>the route detail</p>
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ErrorBoundary', () => {
  it('shows its children when nothing is wrong', () => {
    render(<ErrorBoundary label="route detail"><Boom /></ErrorBoundary>)
    expect(screen.getByText('the route detail')).toBeTruthy()
  })

  it('catches a render error and says the rest of the app is fine', () => {
    render(<ErrorBoundary label="route detail"><Boom explode /></ErrorBoundary>)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('This part of the page stopped working.')
    expect(alert.textContent).toContain('timeline went sideways')
  })

  it('recovers when "Try again" is pressed and the cause has gone', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ErrorBoundary label="route detail"><Boom explode /></ErrorBoundary>)
    rerender(<ErrorBoundary label="route detail"><Boom /></ErrorBoundary>)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('the route detail')).toBeTruthy()
  })

  it('starts fresh when the reset key changes, so another route is not stuck on the error', () => {
    const { rerender } = render(<ErrorBoundary resetKey="a"><Boom explode /></ErrorBoundary>)
    expect(screen.getByRole('alert')).toBeTruthy()
    rerender(<ErrorBoundary resetKey="b"><Boom /></ErrorBoundary>)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('the route detail')).toBeTruthy()
  })
})
