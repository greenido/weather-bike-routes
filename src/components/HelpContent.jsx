/*
  File: src/components/HelpContent.jsx
  Purpose: What the Help dialog says: what the app does, how to use it, how to read a route, how the score
  works, where the forecast comes from, and what leaves the browser.
  Notes:
  - Keep the scoring numbers in sync with the header comment in `src/services/scoringEngine.js`.
*/
import { TemperatureLegend } from './RouteDetail.jsx'
import { MAX_DAYS_AHEAD } from '../services/weatherClient'

export default function HelpContent() {
  return (
    <>
      <p>Bike Route Weather compares bike routes by the weather you’ll ride through. It works out when you’ll reach each point of each route, gets the forecast for that time and place, and scores every route from 1 to 10. Higher is better.</p>

      <Section title="How to use it">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Set the day and time you’ll start (up to {MAX_DAYS_AHEAD} days ahead) and your average speed. The app expects you to slow down on climbs and speed up downhill.</li>
          <li>Add one or more GPX files (tracks or routes): drop them on the upload area or choose them.</li>
          <li>Compare the scores. The best route is on top; select a card to see its details.</li>
          <li>Try another start time or speed. The scores update by themselves.</li>
        </ol>
      </Section>

      <Section title="Reading a route">
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Cards</b>: a sketch of the route, its score, and what cost points. A plus is a bonus, like a tailwind.</li>
          <li>
            <b>Map</b>: the route is colored by the temperature when you’ll get to each point: blue when it’s cold, green in the comfort band, and yellow to red as it gets hotter. Numbers along the route give the temperature (zoom in for more), and labels mark the start, finish, coldest, and warmest spots. Point at the route to see the temperature, time, and distance there. Arrows show your direction.
            <div className="mt-1.5"><TemperatureLegend /></div>
          </li>
          <li><b>Chart</b>: temperature over the shaded 15–22°C comfort band, with elevation below, by distance and time of day. Move along it, or along the route on the map, to see the temperature, feels-like, wind, and chance of rain at any point. With a keyboard, focus the chart and use the arrow keys; Home and End jump to the start and finish. “Show forecast points as a table” lists the exact numbers.</li>
          <li><b>Tips</b>: what to wear or bring, like arm warmers for a cold start.</li>
        </ul>
      </Section>

      <Section title="How the score works">
        <p>Each route starts at 10 and loses points for:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Wind</b>: Average wind over 15 km/h costs 1.5 points (2.5 over 25, 3 over 35, 4 over 45). If it's mostly in your face, that grows up to ×1.8. A steady tailwind gives up to +1.5. Gusts over 40 km/h cost 1 more point, over 55 km/h 2 more.</li>
          <li><b>Temperature</b>: Uses the feels-like temperature, which already accounts for humidity and wind chill. 15–22°C is ideal. Below 15 costs 1 point (2 under 10, 3 under 5); above 22 costs 1 (2 over 30, 3 over 35). Every km of the ride counts. Feeling above 40°C on average is a no‑go.</li>
          <li><b>Rain</b>: The highest chance of rain during the ride. 15% or more costs 1 point, 30% costs 2, 50% costs 3, 70% costs 4.</li>
          <li><b>Visibility</b>: Below 10 km costs 1 point, below 5 km 2 points, below 2 km 3 points.</li>
        </ul>
        <p>The score never goes below 1. Headwind is worked out for each stretch of road, so loops and out-and-back rides are judged fairly.</p>
      </Section>

      <Section title="Where the forecast comes from">
        <ul className="list-disc pl-5 space-y-1">
          <li>Open-Meteo, which is free and needs no key. With a Visual Crossing key in Settings, the app uses Visual Crossing instead. It asks for one point at a time, so the first load is slower.</li>
          <li>Forecasts are taken about every 5 km along each route (farther apart on routes over 200 km). In between, the temperature follows the distance and the elevation, about 0.65°C cooler for every 100 m up.</li>
          <li>Forecasts are saved in your browser for 2 hours, so another speed or start time on the same day doesn’t fetch them again.</li>
        </ul>
      </Section>

      <Section title="Your privacy">
        <p>GPX files are read in your browser and never uploaded. The weather service gets the locations of the forecast points and the dates of your ride, and the map loads OpenStreetMap tiles for the area it shows. A Visual Crossing key is stored only in this browser and sent only to Visual Crossing.</p>
      </Section>
    </>
  )
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      {children}
    </section>
  )
}
