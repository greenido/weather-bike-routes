// File: vite.config.js
// Purpose: Vite configuration enabling the React plugin.
// Docs: https://vitejs.dev/config/
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/weather-bike-routes/',
})
