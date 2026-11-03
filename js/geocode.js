const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
// La policy di Nominatim consente al massimo 1 richiesta al secondo
const MIN_INTERVAL_MS = 1100;

let nextSlotAt = 0;

async function request(path, params) {
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  if (slot > now) await new Promise((resolve) => setTimeout(resolve, slot - now));

  const query = new URLSearchParams({ format: 'jsonv2', ...params });
  const response = await fetch(`${NOMINATIM_URL}/${path}?${query}`);
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  return response.json();
}

function shortName(item) {
  return item.name || item.display_name?.split(',')[0] || '';
}

function toPlace(item) {
  return { name: shortName(item), description: item.display_name, lat: Number(item.lat), lng: Number(item.lon) };
}

/**
 * Cerca luoghi per nome. Con area [ovest, sud, est, nord] cerca prima solo li':
 * nomi generici come "Blue Lagoon" altrimenti finiscono dall'altra parte del mondo.
 * @returns {Promise<{name: string, description: string, lat: number, lng: number}[]>}
 */
export async function searchPlaces(text, language, area = null) {
  const params = { q: text, limit: 5, 'accept-language': language };
  if (area) {
    const nearby = await request('search', { ...params, viewbox: area.join(','), bounded: 1 });
    if (nearby.length) return nearby.map(toPlace);
  }
  return (await request('search', params)).map(toPlace);
}

/** Nome del luogo alle coordinate date, o stringa vuota se non trovato. */
export async function reversePlace(lat, lng, language) {
  const item = await request('reverse', { lat, lon: lng, zoom: 18, 'accept-language': language });
  return item.error ? '' : shortName(item);
}

/** Area [ovest, sud, est, nord] attorno ai punti con coordinate, allargata di un margine; null se nessuno. */
export function areaAround(points, marginDegrees = 0.3) {
  const located = points.filter((point) => point.lat !== null && point.lat !== undefined);
  if (located.length === 0) return null;
  const lats = located.map((point) => point.lat);
  const lngs = located.map((point) => point.lng);
  return [
    Math.min(...lngs) - marginDegrees,
    Math.min(...lats) - marginDegrees,
    Math.max(...lngs) + marginDegrees,
    Math.max(...lats) + marginDegrees,
  ];
}
