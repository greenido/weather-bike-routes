/*
  File: src/main.jsx
  Purpose: React entrypoint that mounts the app to the DOM with StrictMode, and registers the service worker.
  Notes:
  - The worker is registered only in a production build: caching Vite's dev modules would break hot reloading.
    A browser without service workers, or one that refuses to register, simply loses offline support.
*/
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch((err) => {
      console.info('Offline support is unavailable:', err.message)
    })
  })
}
