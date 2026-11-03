// Link di condivisione: il viaggio in formato testo, compresso, nell'hash dell'URL (#t=...)
const HASH_PREFIX = '#t=';

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

/** URL dell'app che contiene il testo del viaggio. */
export async function createShareUrl(text) {
  const code = toBase64Url(await compress(text));
  return `${location.origin}${location.pathname}${HASH_PREFIX}${code}`;
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
