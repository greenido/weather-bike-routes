# Bike Route Weather Scorer (React + Vite)

This app helps cyclists compare multiple GPX routes against forecasted weather to pick the most comfortable ride. Upload one or more GPX files, choose a start date/time and your average speed, and the app works out when you'll reach each point of each route, gets the forecast for that time and place, computes a 1–10 score, and shows the temperature along the whole ride.

## Features

- Route upload via drag & drop or file picker (`.gpx`, tracks or routes)
- Weather from Open-Meteo out of the box (no API key); Visual Crossing is used instead when you add a key in Settings
- Forecast for the time you'll actually be at each point: arrival times come from your start time and average speed (slower on climbs, faster downhill)
- Temperature along the route:
  - Map with the route colored like a weather map (blue when cold, green in the 15–22°C comfort band, yellow to red when hot), temperatures along the way that thin out or fill in as you zoom, a readout for the point under the pointer, direction arrows, and start/finish and coldest/warmest labels
  - Profile chart of temperature (with the 15–22°C comfort band) and elevation by distance and time of day; hover, touch, or use the arrow keys, and the point is highlighted on the map too
  - Table view of the forecast points, plus ride tips ("Below 15°C until km 12 (9:40 AM). Start with arm warmers.")
- Scoring that accounts for wind direction on each stretch of road, gusts, feels-like temperature over the whole ride, chance of rain, and visibility
- Route list sorted by score, with a temperature-colored sketch of each route and the score breakdown
- IndexedDB forecast cache (2 hours) so changing the start time or speed doesn't refetch
- Guided tour for first-time visitors: first the ride settings, upload, Settings, and Help, then the results the first time a route is scored. Help can replay it, and explains how to use the app, how to read a route, the exact scoring numbers, where forecasts come from, and what leaves the browser

## Architecture

- UI: React 19 + Vite + Tailwind CSS
- Maps: `react-leaflet` + `leaflet`
- GPX parsing: the browser's `DOMParser` (no library)
- Caching: `idb` (IndexedDB)
- Weather APIs: Open-Meteo Forecast API (default), Visual Crossing Timeline API (optional)
- Guided tour: `react-joyride`, loaded only when a tour runs
- Tests: Vitest, with React Testing Library and happy-dom for the UI

### Key modules

- `src/App.jsx`: App state; start time, speed, and settings; runs the analysis (debounced and cancellable) and renders the list and the selected route
- `src/components/UploadForm.jsx`: GPX input (drag/drop and button)
- `src/components/RouteList.jsx`: Route cards (best score first) with sketch, score, breakdown, and ride summary
- `src/components/RouteThumbnail.jsx`: Small SVG sketch of a route, colored by temperature
- `src/components/RouteDetail.jsx`: The selected route: headline stats, ride tips, legend, map, and profile
- `src/components/MapPreview.jsx`: Leaflet map with the temperature-colored route, temperature labels, arrows, callouts, and the hover readout
- `src/components/RouteProfile.jsx`: Temperature and elevation chart with crosshair, keyboard support, and table view
- `src/components/ScoreBreakdown.jsx`: Penalty breakdown with icons
- `src/components/TopNav.jsx`: Sticky header with Settings & Help actions
- `src/components/Modal.jsx`: Accessible portal-based dialog used by Settings/Help; long content scrolls
- `src/components/HelpContent.jsx`: What the Help dialog says
- `src/components/GuidedTour.jsx`: The first-run tour: its steps, when each part runs, and progress saved in localStorage. Steps point at `data-tour` attributes
- `src/services/gpxParser.js`: GPX parsing, cumulative distance, and where to sample forecasts (about every 5 km)
- `src/services/routeAnalysis.js`: Arrival times, weather at every point of the ride, ride summary, and tips
- `src/services/weatherClient.js`: Fetches and normalizes forecasts from either provider; interpolates to any time
- `src/services/scoringEngine.js`: Turns a ride summary into a score and its breakdown
- `src/services/temperatureScale.js`: The temperature color scale (a continuous ramp) shared by the map, chart, sketch, and legend
- `src/services/mapLabels.js`: Where the temperature labels go along the route at each zoom, so they never pile up
- `src/services/geo.js`, `src/services/format.js`: Distance/bearing math and display formatting
- `src/services/cache.js`: IndexedDB forecast cache and API key storage
- `src/services/logger.js`: In-memory log with subscriber API

## Setup

Requires Node 22.12 or newer (CI uses Node 24).

1. Install dependencies:
```bash
npm install
```

2. Start the dev server:
```bash
npm run dev
```

3. Open the app at the URL shown in the terminal. On the first visit, a short tour shows you around; Help can replay it.

4. Upload one or more `.gpx` files, adjust the start date/time (default is 24h from now) and your average speed, and review the scores.

5. Optional: to use Visual Crossing instead of Open-Meteo, click "Settings" and paste your key. It is stored locally in your browser.

## Weather API

- Forecasts are sampled about every 5 km along each route (more spread out on very long rides); the start and finish are always included.
- Open-Meteo (default): one request per route covers all of its sample points. Forecasts reach up to 15 days ahead.
- Visual Crossing (with a key): one Timeline API request per sample point, one at a time across all routes, because plans cap how many requests an account can run at once. A "Maximum concurrency exceeded" (429) answer is retried twice, 2 and 5 seconds apart. The first load is slower than with Open-Meteo.
- Each sample uses the forecast for the time you'll get there, interpolated between hours. Between samples, temperature is interpolated by distance and adjusted for elevation (about 0.65°C per 100 m).
- Responses are cached in IndexedDB for 2 hours per provider, location, and date range.

## Scoring model (high level)

Penalties are subtracted from 10, and the result is clamped to 1–10.

- Wind: stronger average winds cost more. A net headwind (worked out for each stretch of road, so loops and out-and-back rides even out) makes it worse; a net tailwind gives up to +1.5. Gusts over 40 km/h cost extra.
- Temperature: feels-like temperature at every point of the ride; 15–22°C is ideal, colder or hotter lowers the score, and an average above 40°C sets the score to 1. Feels-like already accounts for humidity and wind chill, so humidity is no longer scored separately.
- Rain: the highest chance of rain during the ride, from 15% up.
- Visibility: penalties below 10 km, harsher below 5 km and 2 km.

See the header comment in `src/services/scoringEngine.js` and the Help dialog (`src/components/HelpContent.jsx`) for the exact numbers. Keep the two in sync.

## Notes & limits

- Very dense GPX tracks are thinned to about 2,000 points so the map, chart, and analysis stay fast; distances are measured on the full track first.
- Map tiles come from OpenStreetMap (shown in grayscale so the temperature colors stand out) and follow the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/); switch to a tile provider for heavy traffic.
- Open-Meteo's free API is for non-commercial use; see [its terms](https://open-meteo.com/en/terms) before using it commercially.
- This is a client-only app; the optional API key is stored locally and used directly from the browser.

## Scripts

- `npm run dev`: Start Vite dev server
- `npm run build`: Production build
- `npm run preview`: Preview built app
- `npm run lint`: Run ESLint
- `npm test`: Run all tests (Vitest). Service tests run in Node. Component and app tests (`*.test.jsx`), and the GPX parser tests (which need `DOMParser`), run in a simulated browser via `// @vitest-environment happy-dom` at the top of the file. The app tests replace only the network, GPX parsing (tested on its own), and the Leaflet map. Shared test routes live in `src/test/fixtures.js`.

## Deploying to GitHub Pages

This repo is configured to auto-deploy the Vite build to GitHub Pages on pushes to `master`.

- The workflow is in `.github/workflows/deploy.yml`. It runs lint and tests before building.
- Pull requests run lint, tests, and a build in `.github/workflows/checks.yml`. Nothing is deployed from a pull request.
- It builds with a base path of `/${repo}/` so assets work under project pages.
- A `404.html` is generated from `index.html` so client-side routing works.

Steps:
1. Ensure your default branch is `master` or update the workflow trigger.
2. In the repository settings, under Pages, set the source to “GitHub Actions”.
3. Push to `master` (or trigger the workflow manually). The site will be published at `https://<user>.github.io/<repo>/`.
