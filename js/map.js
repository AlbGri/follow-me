import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.16.0/dist/maplibre-gl.mjs';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DAY_COLORS = ['#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4', '#0aa5b8', '#f032e6', '#9a6324'];
const ROUTE_SOURCE = 'routes';
// sotto questo zoom la vista e' troppo ampia per orientare la ricerca
const MIN_ZOOM_FOR_SEARCH_AREA = 6;

let map;
let markers = [];
let routeData = featureCollection([]);

export function dayColor(dayIndex) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

function featureCollection(days) {
  return {
    type: 'FeatureCollection',
    features: days
      .filter((day) => day.stops.length > 1)
      .map((day) => ({
        type: 'Feature',
        properties: { color: day.color },
        geometry: { type: 'LineString', coordinates: day.stops.map((stop) => [stop.lng, stop.lat]) },
      })),
  };
}

function addRouteLayers(target, data) {
  target.addSource(ROUTE_SOURCE, { type: 'geojson', data });
  const layout = { 'line-join': 'round', 'line-cap': 'round' };
  target.addLayer({
    id: 'routes-casing',
    type: 'line',
    source: ROUTE_SOURCE,
    layout,
    paint: { 'line-color': '#ffffff', 'line-width': 7 },
  });
  target.addLayer({
    id: 'routes',
    type: 'line',
    source: ROUTE_SOURCE,
    layout,
    paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
  });
}

function fit(target, stops, padding) {
  if (stops.length === 0) return;
  if (stops.length === 1) {
    target.jumpTo({ center: [stops[0].lng, stops[0].lat], zoom: 13 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds();
  stops.forEach((stop) => bounds.extend([stop.lng, stop.lat]));
  target.fitBounds(bounds, { padding, maxZoom: 15, duration: 0 });
}

/** Crea la mappa; onMapClick(lat, lng) riceve i click sulla mappa (non sui marker). */
export function createMap(container, onMapClick) {
  map = new maplibregl.Map({ container, style: STYLE_URL, center: [10, 30], zoom: 1.5 });
  map.addControl(new maplibregl.NavigationControl(), 'top-right');
  map.on('click', (event) => {
    if (event.originalEvent.target !== map.getCanvas()) return;
    onMapClick(event.lngLat.lat, event.lngLat.lng);
  });
  map.on('load', () => addRouteLayers(map, routeData));
}

/**
 * Ridisegna marker (numerati per giorno) e linee del viaggio.
 * Con visibleDayId mostra solo quel giorno.
 * onMove(stopId, lat, lng) a fine trascinamento, onSelect(stopId) al click.
 */
export function renderTrip(trip, visibleDayId, { onMove, onSelect }) {
  markers.forEach((marker) => marker.remove());
  markers = [];
  const days = trip.days
    .map((day, dayIndex) => ({ ...day, color: dayColor(dayIndex) }))
    .filter((day) => !visibleDayId || day.id === visibleDayId);

  for (const day of days) {
    day.stops.forEach((stop, stopIndex) => {
      const element = document.createElement('div');
      element.className = 'marker';
      element.style.background = day.color;
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
  }

  routeData = featureCollection(days);
  map.getSource(ROUTE_SOURCE)?.setData(routeData);
}

/** Inquadra le tappe date (lascia spazio in alto per i chip del filtro). */
export function fitStops(stops) {
  fit(map, stops, { top: 70, bottom: 50, left: 50, right: 60 });
}

export function flyTo(lat, lng) {
  map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
}

/** Area visibile [ovest, sud, est, nord] per orientare la ricerca, null se la vista e' troppo ampia. */
export function getViewArea() {
  if (map.getZoom() < MIN_ZOOM_FOR_SEARCH_AREA) return null;
  const bounds = map.getBounds();
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
}

/**
 * Mappa temporanea fuori schermo per l'export, di dimensioni fisse indipendenti dallo schermo.
 * @param {{width: number, height: number, pixelRatio: number, days: {color: string, stops: object[]}[]}} options
 *   width/height in pixel CSS, il canvas risultante e' moltiplicato per pixelRatio
 * @returns {Promise<{canvas: HTMLCanvasElement, project: (lng: number, lat: number) => {x: number, y: number}, remove: () => void}>}
 */
export async function createSnapshotMap({ width, height, pixelRatio, days }) {
  const container = document.createElement('div');
  Object.assign(container.style, { position: 'fixed', left: '-20000px', top: '0', width: `${width}px`, height: `${height}px` });
  document.body.append(container);
  const snapshot = new maplibregl.Map({
    container,
    style: STYLE_URL,
    pixelRatio,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });
  const remove = () => {
    snapshot.remove();
    container.remove();
  };
  try {
    await snapshot.once('load');
    addRouteLayers(snapshot, featureCollection(days));
    fit(snapshot, days.flatMap((day) => day.stops), { top: 50, bottom: 50, left: 50, right: 50 });
    await snapshot.once('idle');
  } catch (error) {
    remove();
    throw error;
  }
  return { canvas: snapshot.getCanvas(), project: (lng, lat) => snapshot.project([lng, lat]), remove };
}
