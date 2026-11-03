import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DAY_COLORS = ['#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4', '#0aa5b8', '#f032e6', '#9a6324'];

let map;
let markers = [];

export function dayColor(dayIndex) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

/** Crea la mappa; onMapClick(lat, lng) riceve i click sulla mappa (non sui marker). */
export function createMap(container, onMapClick) {
  map = new maplibregl.Map({ container, style: STYLE_URL, center: [10, 30], zoom: 1.5 });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('click', (event) => {
    if (event.originalEvent.target !== map.getCanvas()) return;
    onMapClick(event.lngLat.lat, event.lngLat.lng);
  });
}

/**
 * Ridisegna i marker del viaggio, numerati per giorno.
 * onMove(stopId, lat, lng) a fine trascinamento, onSelect(stopId) al click.
 */
export function renderStops(trip, { onMove, onSelect }) {
  markers.forEach((marker) => marker.remove());
  markers = [];
  trip.days.forEach((day, dayIndex) => {
    day.stops.forEach((stop, stopIndex) => {
      const element = document.createElement('div');
      element.className = 'marker';
      element.style.background = dayColor(dayIndex);
      element.textContent = String(stopIndex + 1);
      element.addEventListener('click', () => onSelect(stop.id));

      const marker = new maplibregl.Marker({ element, draggable: true })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLngLat();
        onMove(stop.id, lat, lng);
      });
      markers.push(marker);
    });
  });
}

/** Inquadra tutte le tappe del viaggio. */
export function fitTrip(trip) {
  const stops = trip.days.flatMap((day) => day.stops);
  if (stops.length === 0) return;
  if (stops.length === 1) {
    map.jumpTo({ center: [stops[0].lng, stops[0].lat], zoom: 13 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  stops.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
  map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 0 });
}

export function flyTo(lat, lng) {
  map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
}
