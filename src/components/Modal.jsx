/*
  File: src/components/Modal.jsx
  Purpose: Accessible portal-based modal component used for Settings and Help dialogs.
  What it does:
  - Renders children content in a centered dialog via React Portal into `document.body`.
  - Supports a dimmed backdrop that closes the modal on click and an optional footer area.
  - Behaves like a dialog for keyboard and screen-reader users: role="dialog", Escape closes it, Tab stays
    inside it, focus moves in on open and returns to where it was on close.
  - Long content scrolls between the fixed title and footer. Without a field to focus, focus goes to the
    content so the arrow keys scroll it.
*/
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

export default function Modal({ title, open, onClose, children, footer }) {
  const dialogRef = useRef(null)
  const bodyRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    const returnFocusTo = document.activeElement
    ;(dialog.querySelector('input, select, textarea') || bodyRef.current).focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      returnFocusTo?.focus?.()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative bg-white w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl shadow-lg border mx-4 focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div ref={bodyRef} tabIndex={-1} className="min-h-0 overflow-y-auto px-4 pb-4 text-sm text-gray-800 space-y-3 focus:outline-none">
          {children}
        </div>
        {footer && (
          <div className="px-4 pt-3 pb-4 border-t flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
