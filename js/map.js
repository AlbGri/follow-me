import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DAY_COLORS = ['#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4', '#0aa5b8', '#f032e6', '#9a6324'];
const ROUTE_SOURCE = 'routes';

let map;
let markers = [];
let routeData = { type: 'FeatureCollection', features: [] };

export function dayColor(dayIndex) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

export function getMap() {
  return map;
}

/** Crea la mappa; onMapClick(lat, lng) riceve i click sulla mappa (non sui marker). */
export function createMap(container, onMapClick) {
  map = new maplibregl.Map({
    container,
    style: STYLE_URL,
    center: [10, 30],
    zoom: 1.5,
    // serve per leggere il canvas nell'export PNG
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('click', (event) => {
    if (event.originalEvent.target !== map.getCanvas()) return;
    onMapClick(event.lngLat.lat, event.lngLat.lng);
  });
  map.on('load', () => {
    map.addSource(ROUTE_SOURCE, { type: 'geojson', data: routeData });
    const layout = { 'line-join': 'round', 'line-cap': 'round' };
    map.addLayer({
      id: 'routes-casing',
      type: 'line',
      source: ROUTE_SOURCE,
      layout,
      paint: { 'line-color': '#ffffff', 'line-width': 7 },
    });
    map.addLayer({
      id: 'routes',
      type: 'line',
      source: ROUTE_SOURCE,
      layout,
      paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
    });
  });
}

/**
 * Ridisegna marker (numerati per giorno) e linee del viaggio.
 * Con visibleDayId mostra solo quel giorno.
 * onMove(stopId, lat, lng) a fine trascinamento, onSelect(stopId) al click.
 */
export function renderTrip(trip, visibleDayId, { onMove, onSelect }) {
  markers.forEach((marker) => marker.remove());
  markers = [];
  const features = [];

  trip.days.forEach((day, dayIndex) => {
    if (visibleDayId && day.id !== visibleDayId) return;
    const color = dayColor(dayIndex);
    if (day.stops.length > 1) {
      features.push({
        type: 'Feature',
        properties: { color },
        geometry: { type: 'LineString', coordinates: day.stops.map((stop) => [stop.lng, stop.lat]) },
      });
    }
    day.stops.forEach((stop, stopIndex) => {
      const element = document.createElement('div');
      element.className = 'marker';
      element.style.background = color;
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

  routeData = { type: 'FeatureCollection', features };
  map.getSource(ROUTE_SOURCE)?.setData(routeData);
}

/** Inquadra le tappe date. */
export function fitStops(stops) {
  if (stops.length === 0) return;
  if (stops.length === 1) {
    map.jumpTo({ center: [stops[0].lng, stops[0].lat], zoom: 13 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  stops.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
  map.fitBounds(bounds, { padding: { top: 70, bottom: 50, left: 50, right: 60 }, maxZoom: 15, duration: 0 });
}

export function flyTo(lat, lng) {
  map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
}
