// Link corti per Follow Me (fm.albgri.com).
// POST / con il viaggio compresso (lo stesso codice dei link lunghi #t=) -> { url: "https://fm.albgri.com/<id>" }
// GET /<id> -> redirect all'app con il link lungo: l'app non deve sapere nulla dei link corti.
const APP_URL = 'https://albgri.github.io/follow-me/';
const ALLOWED_ORIGINS = [/^https:\/\/albgri\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const MAX_CODE_LENGTH = 20000;
const MAX_TEXT_LENGTH = 50000;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const ID_PATTERN = /^[A-Za-z0-9]{8,12}$/;
// 8 caratteri base62 bastano; i 12 servono solo nel caso (remoto) di due viaggi con lo stesso prefisso
const ID_LENGTHS = [8, 12];
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// una riga di tappa: "1. ...", "2) ...", "- ..."
const STOP_LINE = /^\s*(?:\d+[.)]|[-*•])\s+\S/m;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin'));

    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    if (request.method === 'POST' && url.pathname === '/') {
      if (!cors) return new Response('Origin not allowed', { status: 403 });
      // sempre https: in sviluppo locale l'origine sarebbe http
      return createLink(request, env, `https://${url.host}`, cors);
    }
    if (request.method === 'GET' || request.method === 'HEAD') return openLink(url.pathname.slice(1), env);
    return new Response('Method not allowed', { status: 405 });
  },
};

function corsHeaders(origin) {
  if (!origin || !ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function createLink(request, env, origin, cors) {
  const code = (await request.text()).trim();
  if (code.length > MAX_CODE_LENGTH || !BASE64URL.test(code) || !(await isTrip(code))) {
    return new Response('Invalid trip', { status: 400, headers: cors });
  }
  // l'id deriva dal contenuto: stesso viaggio, stesso link, nessun duplicato
  // e nessuna scrittura inutile (il piano free di KV ne consente 1000 al giorno)
  for (const length of ID_LENGTHS) {
    const id = await contentId(code, length);
    const stored = await env.TRIPS.get(id);
    if (stored === code) return Response.json({ url: `${origin}/${id}` }, { headers: cors });
    if (stored === null) {
      await env.TRIPS.put(id, code);
      return Response.json({ url: `${origin}/${id}` }, { headers: cors });
    }
  }
  return new Response('Id collision', { status: 409, headers: cors });
}

async function openLink(id, env) {
  if (!id) return Response.redirect(APP_URL, 302);
  const code = ID_PATTERN.test(id) ? await env.TRIPS.get(id) : null;
  if (!code) return notFoundPage();
  return Response.redirect(`${APP_URL}#t=${code}`, 302);
}

/** Il codice deve essere un testo compresso, non troppo grande, con almeno una tappa. */
async function isTrip(code) {
  try {
    const bytes = Uint8Array.from(atob(code.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = '';
    // lettura a pezzi: un testo che si espande oltre il limite viene scartato subito
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      if (text.length > MAX_TEXT_LENGTH) {
        await reader.cancel();
        return false;
      }
    }
    return STOP_LINE.test(text);
  } catch {
    return false;
  }
}

async function contentId(code, length) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)));
  let value = digest.reduce((number, byte) => (number << 8n) | BigInt(byte), 0n);
  let id = '';
  while (id.length < length) {
    id += BASE62[Number(value % 62n)];
    value /= 62n;
  }
  return id;
}

function notFoundPage() {
  const html = `<!doctype html><html lang="it"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Follow Me</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.5">
<h1>Follow Me</h1><p>Link non trovato o non valido. / Link not found or invalid.</p>
<p><a href="${APP_URL}">Apri Follow Me / Open Follow Me</a></p></body></html>`;
  return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
