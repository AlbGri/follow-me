// Link di condivisione: il viaggio in formato testo, compresso, nell'hash dell'URL (#t=...)
const HASH_PREFIX = '#t=';
// Worker in worker/: salva il codice e risponde con un link corto che rimanda qui
const SHORT_LINK_SERVICE = 'https://fm.albgri.com/';
const SHORT_LINK_TIMEOUT_MS = 5000;

async function compress(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).text();
}

function toBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/**
 * Link di condivisione: corto (fm.albgri.com) se il servizio risponde, altrimenti quello lungo
 * con il viaggio nell'URL, che funziona sempre, anche offline.
 * @returns {Promise<{url: string, short: boolean}>}
 */
export async function createShareUrl(text) {
  const code = toBase64Url(await compress(text));
  try {
    return { url: await createShortUrl(code), short: true };
  } catch {
    return { url: `${location.origin}${location.pathname}${HASH_PREFIX}${code}`, short: false };
  }
}

async function createShortUrl(code) {
  const response = await fetch(SHORT_LINK_SERVICE, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: code,
    signal: AbortSignal.timeout(SHORT_LINK_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Link corto: ${response.status}`);
  return (await response.json()).url;
}

/**
 * Testo del viaggio contenuto nell'URL corrente, o null se assente.
 * Rimuove l'hash, cosi' un reload non ripropone l'import.
 * @throws se il link e' danneggiato
 */
export async function readSharedText() {
  if (!location.hash.startsWith(HASH_PREFIX)) return null;
  const code = location.hash.slice(HASH_PREFIX.length);
  history.replaceState(null, '', location.pathname + location.search);
  return decompress(fromBase64Url(code));
}
