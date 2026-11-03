// Finestre di import/export del viaggio
import { el, downloadBlob } from './dom.js';
import { t, getLanguage } from './i18n.js';
import { textToTrip } from './textformat.js';
import { dayIsoDate, formatDate } from './dates.js';
import { searchPlaces, areaAround } from './geocode.js';
import { openDialog, closeDialog, hint, actions, closeButton, copyText } from './dialog.js';

function copyButton(text, status) {
  return el('button', { type: 'button', className: 'primary', textContent: t('dialog.copy'), onclick: () => copyText(text, status) });
}

/** Mostra il viaggio come testo, da copiare o scaricare come .txt. */
export function openTextExport(text, filename) {
  const status = el('p', { className: 'status' });
  openDialog(
    t('export.title'),
    hint(t('export.help')),
    el('textarea', { className: 'dialog-text', value: text, readOnly: true, rows: 12 }),
    hint(t('export.chars', { count: text.length })),
    status,
    actions(
      copyButton(text, status),
      el('button', {
        type: 'button',
        textContent: t('export.download'),
        onclick: () => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename),
      }),
      closeButton(),
    ),
  );
}

/** Mostra il link di condivisione, con condivisione nativa dove disponibile (mobile). */
export function openShareLink(url, title) {
  const status = el('p', { className: 'status' });
  const input = el('input', { className: 'share-url', value: url, readOnly: true, onfocus: () => input.select() });
  const nativeShare = navigator.share
    ? [el('button', { type: 'button', textContent: t('share.native'), onclick: () => navigator.share({ title, url }).catch(() => {}) })]
    : [];
  openDialog(
    t('share.title'),
    hint(t('share.help')),
    input,
    hint(t('share.length', { count: url.length })),
    status,
    actions(copyButton(url, status), ...nativeShare, closeButton()),
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
    className: 'dialog-text',
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
  const analyzeButton = el('button', { type: 'button', textContent: t('import.analyze'), onclick: () => analyze() });
  const confirmButton = el('button', {
    type: 'button',
    className: 'primary',
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
      status.textContent = t('import.empty');
      return;
    }

    const missing = stops.filter((stop) => stop.lat === null);
    const toSearch = missing.filter((stop) => stop.name && !searched.has(stop.name));
    analyzeButton.disabled = true;
    try {
      for (const [index, stop] of toSearch.entries()) {
        status.textContent = t('import.geocoding', { name: stop.name, current: index + 1, total: toSearch.length });
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
      status.textContent = t('error.geocode');
      return;
    } finally {
      analyzeButton.disabled = false;
    }

    review.replaceChildren(...parsed.days.map((day, dayIndex) => renderReviewDay(day, dayIndex, parsed.startDate)));
    const ready = stops.filter((stop) => stop.lat !== null).length;
    status.textContent = t('import.summary', { count: ready, total: stops.length });
    confirmButton.disabled = ready === 0;
  }

  openDialog(
    t('import.title'),
    ...(notice ? [el('p', { className: 'notice', textContent: notice })] : []),
    hint(t('import.help')),
    area,
    el('label', { className: 'file-label' }, `${t('import.file')} `, fileInput),
    status,
    review,
    actions(analyzeButton, confirmButton, closeButton()),
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
