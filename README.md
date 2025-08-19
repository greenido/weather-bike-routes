# Bike Route Weather Scorer (React + Vite)

This app helps cyclists compare multiple GPX routes against forecasted weather to pick the most comfortable ride. Upload one or more GPX files, choose a start date/time, and the app will fetch weather along each route, compute a 1–10 score, and visualize the results.

## Features

- Route upload via drag & drop or file picker (`.gpx`)
- Weather fetch from Visual Crossing with IndexedDB day-level caching
- Per-route aggregation of wind, temperature, humidity, and visibility
- Scoring engine that accounts for headwinds/tailwinds and comfort bands
- List of routes with mini map previews and score breakdown
- Map preview of the selected route using Leaflet + OpenStreetMap tiles
- Simple in-app logger for development insights

## Architecture

- UI: React 19 + Vite + Tailwind CSS
- Maps: `react-leaflet` + `leaflet`
- GPX parsing: `gpxparser`
- Caching: `idb` (IndexedDB)
- Weather API: Visual Crossing Timeline API

### Key modules

- `src/App.jsx`: App state, orchestration of parsing → fetching → scoring → rendering
- `src/components/UploadForm.jsx`: GPX input (drag/drop and button)
- `src/components/RouteList.jsx`: Route cards with score and conditions
- `src/components/MapPreview.jsx`: Mini map with polyline + auto-fit
- `src/components/ScoreBreakdown.jsx`: Penalty breakdown with icons
- `src/components/TopNav.jsx`: Sticky header with Settings & Help actions
- `src/components/Modal.jsx`: Portal-based modal used by Settings/Help
- `src/components/LoggerPanel.jsx`: Optional developer log viewer
- `src/services/gpxParser.js`: File parsing, waypoint sampling, heading estimate
- `src/services/weatherClient.js`: Fetch + aggregate weather along a route
- `src/services/scoringEngine.js`: Convert weather + heading to score and color
- `src/services/cache.js`: IndexedDB weather cache and API key storage
- `src/services/logger.js`: In-memory log with subscriber API

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

3. Open the app at the URL shown in the terminal.

4. Provide your Visual Crossing API key:
   - Click “Settings” in the top bar.
   - Paste your key; it is stored locally in your browser.

5. Upload one or more `.gpx` files, adjust the start date/time (default is 24h from now), and review scores.

## Weather API

- The app uses the Visual Crossing Timeline API (`/rest/services/timeline`).
- When a time component is provided in the ISO string, the closest hourly forecast is chosen. Otherwise day/current is used.
- Responses are cached per `(lat, lon, day)` in IndexedDB to reduce calls while testing.

## Scoring model (high level)

- Wind: stronger winds reduce the score; headwinds penalize more; tailwinds grant a small bonus.
- Temperature: ideal band 15–22°C; colder/hotter lowers the score; extreme heat (>40°C) clamps to 1.
- Humidity: penalties at ≥68%, ≥80%, and ≥90%.
- Visibility: penalties below 10 km, harsher below 5 km and 2 km.

See inline comments in `src/services/scoringEngine.js` and the Help modal for details.

## Notes & limits

- GPX sampling is interval-based to limit API calls; endpoints are always included.
- Map tiles use OpenStreetMap; attribution is handled by Leaflet defaults.
- This is a client-only app; API key is stored locally and used directly from the browser.

## Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Production build
- `npm run preview`: Preview built app
- `npm run lint`: Run ESLint

## Deploying to GitHub Pages

This repo is configured to auto-deploy the Vite build to GitHub Pages on pushes to `master`.

- The workflow is in `.github/workflows/deploy.yml`.
- It builds with a base path of `/${repo}/` so assets work under project pages.
- A `404.html` is generated from `index.html` so client-side routing works.

Steps:
1. Ensure your default branch is `master` or update the workflow trigger.
2. In the repository settings, under Pages, set the source to “GitHub Actions”.
3. Push to `master` (or trigger the workflow manually). The site will be published at `https://<user>.github.io/<repo>/`.
