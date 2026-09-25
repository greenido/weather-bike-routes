/**
 * File: tailwind.config.js
 * Purpose: Tailwind configuration to scan project files and extend the design system.
 */
/** @type {import('tailwindcss').Config} */
export default {
  // Dark mode follows the `dark` class on <html>, set by index.html before the first paint and by theme.js
  // afterwards, so a rider can override their system setting from the top bar.
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
