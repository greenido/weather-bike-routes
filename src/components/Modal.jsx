import { createPortal } from 'react-dom'

export default function Modal({ title, open, onClose, children, footer }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-xl shadow-lg border p-4 mx-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>✕</button>
        </div>
        <div className="text-sm text-gray-800 space-y-3">
          {children}
        </div>
        {footer && (
          <div className="mt-4 pt-3 border-t flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}


