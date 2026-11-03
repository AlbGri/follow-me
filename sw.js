// Service worker: l'app funziona offline (mappa esclusa).
// File dell'app: prima la rete (gli aggiornamenti arrivano subito), cache se offline.
// MapLibre da unpkg: versione fissata, quindi cache-first.
// Tile e Nominatim non vengono mai messi in cache (policy dei servizi).
const CACHE_NAME = 'follow-me-v1';
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/dom.js',
  'js/export-image.js',
  'js/geocode.js',
  'js/i18n.js',
  'js/map.js',
  'js/share.js',
  'js/store.js',
  'js/textformat.js',
  'js/transfer.js',
  'i18n/it.json',
  'i18n/en.json',
  'icons/icon.svg',
  'icons/icon-192.png',
];
const CDN_HOST = 'unpkg.com';
// Versione allineata a index.html e js/map.js. Il worker viene richiesto con ?v=
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@6.16.0/dist';
const CDN_FILES = [`${MAPLIBRE}/maplibre-gl.css`, `${MAPLIBRE}/maplibre-gl.mjs`, `${MAPLIBRE}/maplibre-gl-worker.mjs?v=6.16.0`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_FILES, ...CDN_FILES])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.host === CDN_HOST) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
