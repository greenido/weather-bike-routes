/*
  File: src/components/UploadForm.jsx
  Purpose: Drag-and-drop and file picker for GPX files.
  What it does:
  - Accepts `.gpx` files (multiple), then normalizes to an array and passes to `onFiles`.
  - Supports drag-over/drop and a button-triggered hidden file input.
*/
import { useRef } from 'react'

export default function UploadForm({ onFiles }) {
  const inputRef = useRef(null)

  function handleFiles(files) {
    const list = Array.from(files || [])
    if (list.length) onFiles(list)
  }

  return (
    <div
      className="border-2 border-dashed border-gray-400 rounded-xl p-6 bg-white flex flex-col items-center justify-center text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        handleFiles(e.dataTransfer.files)
      }}
    >
      <p className="text-lg text-gray-700 mb-3">Drag & drop GPX files here</p>
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        onClick={() => inputRef.current?.click()}
      >
        Choose Files
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".gpx"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}


