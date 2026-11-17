// Finestre di import/export del viaggio
import { el, downloadBlob } from './dom.js';
import { t, getLanguage } from './i18n.js';
import { textToTrip } from './textformat.js';
import { dayIsoDate, formatDate } from './dates.js';
import { searchPlaces, areaAround } from './geocode.js';
import { openDialog, closeDialog, hint, actions, closeButton, copyText, setStatus } from './dialog.js';

function copyButton(text, status) {
  return el('button', { type: 'button', className: 'btn primario', textContent: t('dialog.copy'), onclick: () => copyText(text, status) });
}

const EXPORT_FORMAT_KEY = 'followme.exportFormat';

/**
 * Mostra il viaggio come testo, da copiare o scaricare come .txt, nei due formati:
 * full (con simboli e coordinate, per reimportare) e share (da leggere, per post e messaggi).
 * L'ultimo formato scelto viene ricordato.
 * @param {{full: string, share: string}} texts
 */
export function openTextExport(texts, filename) {
  let format = localStorage.getItem(EXPORT_FORMAT_KEY) === 'share' ? 'share' : 'full';
  const status = el('p', { className: 'status' });
  const help = hint('');
  const area = el('textarea', { className: 'campo codice', readOnly: true, rows: 12 });
  const count = hint('');
  const formatButtons = ['full', 'share'].map((key) =>
    el('button', { type: 'button', className: 'btn', textContent: t(`export.format.${key}`), onclick: () => show(key) }),
  );

  function show(key) {
    format = key;
    localStorage.setItem(EXPORT_FORMAT_KEY, key);
    formatButtons.forEach((button, index) => button.setAttribute('aria-pressed', ['full', 'share'][index] === key));
    help.textContent = t(`export.help.${key}`);
    area.value = texts[key];
    count.textContent = t('export.chars', { count: texts[key].length });
    setStatus(status, '');
  }

  openDialog(
    t('export.title'),
    el('div', { className: 'segmenti' }, ...formatButtons),
    help,
    area,
    count,
    status,
    actions(
      closeButton(),
      el('button', {
        type: 'button',
        className: 'btn',
        textContent: t('export.download'),
        onclick: () => downloadBlob(new Blob([texts[format]], { type: 'text/plain;charset=utf-8' }), filename),
      }),
      el('button', {
        type: 'button',
        className: 'btn primario',
        textContent: t('dialog.copy'),
        onclick: () => copyText(texts[format], status),
      }),
    ),
  );
  show(format);
}

/**
 * Mostra il link di condivisione, con condivisione nativa dove disponibile (mobile).
 * @param {{url: string, short: boolean}} link short false = servizio dei link corti non raggiungibile
 */
export function openShareLink({ url, short }, title) {
  const status = el('p', { className: 'status' });
  const input = el('input', { className: 'campo', value: url, readOnly: true, onfocus: () => input.select() });
  const nativeShare = navigator.share
    ? [el('button', { type: 'button', className: 'btn', textContent: t('share.native'), onclick: () => navigator.share({ title, url }).catch(() => {}) })]
    : [];
  openDialog(
    t('share.title'),
    hint(t('share.help')),
    input,
    ...(short ? [] : [hint(t('share.longFallback', { count: url.length }))]),
    status,
    actions(closeButton(), ...nativeShare, copyButton(url, status)),
  );
}

/**
 * Import da testo: analizza, cerca per nome le tappe senza coordinate, mostra il riepilogo
 * e chiama onImport(viaggio letto) alla conferma. Con text gia' presente l'analisi parte subito.
 */
export function openTextImport({ text = '', notice = '', onImport }) {
  let parsed = null;
  // risultati gia' ottenuti per nome (anche "non trovato"): rianalizzando si cercano solo le righe nuove
  const searched = new Map();
  const status = el('p', { className: 'status' });
  const review = el('div', { className: 'import-review' });
  const area = el('textarea', {
    className: 'campo codice',
    value: text,
    rows: 10,
    placeholder: t('import.placeholder'),
    oninput: () => {
      confirmButton.disabled = true;
    },
  });
  const fileInput = el('input', {
    type: 'file',
    accept: '.txt,text/plain',
    onchange: async () => {
      const [file] = fileInput.files;
      if (!file) return;
      area.value = await file.text();
      analyze();
    },
  });
  const analyzeButton = el('button', { type: 'button', className: 'btn', textContent: t('import.analyze'), onclick: () => analyze() });
  const confirmButton = el('button', {
    type: 'button',
    className: 'btn primario',
    textContent: t('import.confirm'),
    disabled: true,
    onclick: () => {
      onImport(parsed);
      closeDialog();
    },
  });

  async function analyze() {
    parsed = textToTrip(area.value);
    confirmButton.disabled = true;
    review.replaceChildren();
    const stops = parsed.days.flatMap((day) => day.stops);
    if (stops.length === 0) {
      setStatus(status, t('import.empty'), true);
      return;
    }

    const missing = stops.filter((stop) => stop.lat === null);
    const toSearch = missing.filter((stop) => stop.name && !searched.has(stop.name));
    analyzeButton.disabled = true;
    try {
      for (const [index, stop] of toSearch.entries()) {
        setStatus(status, t('import.geocoding', { name: stop.name, current: index + 1, total: toSearch.length }));
        // zona preferita: quella delle tappe gia' localizzate in questo testo
        const area = areaAround(stops);
        const [place] = await searchPlaces(stop.name, getLanguage(), area);
        searched.set(stop.name, place ?? null);
        if (place) Object.assign(stop, { lat: place.lat, lng: place.lng });
      }
      for (const stop of missing) {
        const place = searched.get(stop.name);
        if (place) Object.assign(stop, { lat: place.lat, lng: place.lng, found: place.description });
      }
    } catch {
      setStatus(status, t('error.geocode'), true);
      return;
    } finally {
      analyzeButton.disabled = false;
    }

    review.replaceChildren(...parsed.days.map((day, dayIndex) => renderReviewDay(day, dayIndex, parsed.startDate)));
    const ready = stops.filter((stop) => stop.lat !== null).length;
    setStatus(status, t('import.summary', { count: ready, total: stops.length }));
    confirmButton.disabled = ready === 0;
  }

  openDialog(
    t('import.title'),
    ...(notice ? [el('p', { className: 'avviso', textContent: notice })] : []),
    hint(t('import.help')),
    area,
    el('label', { className: 'etichetta' }, `${t('import.file')} `, fileInput),
    status,
    review,
    actions(closeButton(), analyzeButton, confirmButton),
  );
  if (text) analyze();
}

function renderReviewDay(day, dayIndex, startDate) {
  const date = formatDate(dayIsoDate(startDate, dayIndex), getLanguage(), 'long');
  const heading = [date, day.label].filter(Boolean).join(' · ') || t('day.default', { n: dayIndex + 1 });
  const items = day.stops.map((stop) => {
    const detail = stop.lat === null ? t('import.notFound') : stop.found ?? '';
    return el(
      'li',
      { className: stop.lat === null ? 'missing' : '' },
      el('span', { textContent: [stop.time, stop.name || t('stop.unnamed')].filter(Boolean).join(' ') }),
      ...(detail ? [el('small', { textContent: detail })] : []),
    );
  });
  return el(
    'section',
    {},
    el('h3', { textContent: heading }),
    items.length ? el('ol', {}, ...items) : hint(t('day.empty')),
  );
}
