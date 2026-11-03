// Link pubblici di Google Maps (nessuna API key): luogo, indicazioni, percorso di un giorno
const MAPS_URL = 'https://www.google.com/maps';
// origine + destinazione + al massimo 9 tappe intermedie
const MAX_STOPS_PER_ROUTE = 11;

const point = (stop) => `${stop.lat},${stop.lng}`;

export function placeUrl(stop) {
  return `${MAPS_URL}/search/?${new URLSearchParams({ api: '1', query: point(stop) })}`;
}

/** Indicazioni dalla posizione attuale (Google la usa quando manca l'origine). */
export function directionsUrl(stop) {
  return `${MAPS_URL}/dir/?${new URLSearchParams({ api: '1', destination: point(stop) })}`;
}

/**
 * Percorso di un giorno, diviso in piu' parti se supera il limite di Google.
 * Le parti si sovrappongono sulla tappa di confine. from/to sono numeri di tappa (da 1).
 * @returns {{from: number, to: number, url: string}[]}
 */
export function routeUrls(stops) {
  const routes = [];
  for (let start = 0; start < stops.length - 1; start += MAX_STOPS_PER_ROUTE - 1) {
    const chunk = stops.slice(start, start + MAX_STOPS_PER_ROUTE);
    const params = { api: '1', origin: point(chunk[0]), destination: point(chunk.at(-1)) };
    if (chunk.length > 2) params.waypoints = chunk.slice(1, -1).map(point).join('|');
    routes.push({ from: start + 1, to: start + chunk.length, url: `${MAPS_URL}/dir/?${new URLSearchParams(params)}` });
  }
  return routes;
}
