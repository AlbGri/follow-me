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

/**
 * Cerca luoghi per nome.
 * @returns {Promise<{name: string, description: string, lat: number, lng: number}[]>}
 */
export async function searchPlaces(text, language) {
  const results = await request('search', { q: text, limit: 5, 'accept-language': language });
  return results.map((item) => ({
    name: shortName(item),
    description: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

/** Nome del luogo alle coordinate date, o stringa vuota se non trovato. */
export async function reversePlace(lat, lng, language) {
  const item = await request('reverse', { lat, lon: lng, zoom: 18, 'accept-language': language });
  return item.error ? '' : shortName(item);
}
