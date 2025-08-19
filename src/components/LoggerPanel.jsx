import { useEffect, useState } from 'react'
import { subscribe, clear } from '../services/logger'

export default function LoggerPanel() {
  const [open, setOpen] = useState(false)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    return subscribe(setLogs)
  }, [])

  return (
    <div className="mt-10">
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100">
          <button className="text-lg font-semibold" onClick={() => setOpen(!open)}>
            {open ? '▼' : '▲'} Logger ({logs.length})
          </button>
          <button className="text-sm text-red-600 hover:underline" onClick={() => clear()}>Clear</button>
        </div>
        {open && (
          <div className="max-h-96 overflow-auto text-sm">
            {logs.length === 0 ? (
              <div className="p-4 text-gray-500">No logs yet.</div>
            ) : (
              <ul className="divide-y">
                {logs.map((l) => (
                  <li key={l.id} className="p-3">
                    <div className="text-gray-500 text-xs mb-1">{new Date(l.timestamp).toLocaleTimeString()} • {l.type}</div>
                    <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
{JSON.stringify(l, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


