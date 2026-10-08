/*
  File: src/components/Toast.jsx
  Purpose: A short, low-key message at the bottom of the screen.
  What it does:
  - Shows `message`, hides itself after `durationMs`, and can be closed right away.
  - Stays closed while the message stays the same; give it a `key` of the message so a new one shows again.
*/
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export default function Toast({ message, durationMs = 8000 }) {
  const [isOpen, setIsOpen] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setIsOpen(false), durationMs)
    return () => clearTimeout(timer)
  }, [durationMs])

  if (!isOpen) return null
  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex justify-center pointer-events-none">
      <div role="status" className="pointer-events-auto flex items-center gap-3 max-w-md rounded-lg bg-gray-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-sm shadow-lg pl-4 pr-2 py-2">
        <p>{message}</p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-1 hover:bg-white/15 dark:hover:bg-slate-900/10"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
