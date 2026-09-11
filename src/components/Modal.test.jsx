// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from './Modal.jsx'

afterEach(cleanup)

function SettingsExample({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  const close = () => {
    onClose()
    setOpen(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open settings</button>
      <Modal title="Settings" open={open} onClose={close} footer={<button type="button" onClick={close}>Save</button>}>
        <label>API key <input /></label>
      </Modal>
    </>
  )
}

async function openSettings(onClose) {
  const user = userEvent.setup()
  render(<SettingsExample onClose={onClose} />)
  const opener = screen.getByRole('button', { name: 'Open settings' })
  await user.click(opener)
  return { user, opener }
}

describe('Modal', () => {
  it('opens as a labelled dialog with focus on its first field', async () => {
    await openSettings()
    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'API key' }))
  })

  it('closes on Escape and gives focus back to the button that opened it', async () => {
    const onClose = vi.fn()
    const { user, opener } = await openSettings(onClose)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside the dialog', async () => {
    const { user } = await openSettings()
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save' })
    save.focus()
    await user.tab()
    expect(document.activeElement).toBe(close)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(save)
  })

  it('focuses the content when there is no field, so the arrow keys scroll it', () => {
    render(<Modal title="Help" open onClose={() => {}}><p>How to use it</p></Modal>)
    const content = screen.getByText('How to use it').parentElement
    expect(document.activeElement).toBe(content)
    expect(content.className).toContain('overflow-y-auto')
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const { user } = await openSettings(onClose)
    await user.click(screen.getByRole('dialog').previousElementSibling)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
