/**
 * File: tailwind.config.js
 * Purpose: Tailwind configuration to scan project files and extend the design system.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
