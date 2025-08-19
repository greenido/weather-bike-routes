import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function MapPreview({ path, color = 'blue' }) {
  if (!path?.length) return null
  const center = [path[0].lat, path[0].lon]
  const positions = path.map(p => [p.lat, p.lon])
  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Polyline positions={positions} pathOptions={{ color }} />
        <FitBounds positions={positions} />
      </MapContainer>
    </div>
  )
}

function FitBounds({ positions }) {
  const map = useMap()
  if (positions?.length > 1) {
    const bounds = positions.reduce((acc, [lat, lng]) => acc.extend([lat, lng]), L.latLngBounds(positions[0], positions[0]))
    map.fitBounds(bounds, { padding: [10, 10] })
  }
  return null
}


