import Sortable from 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.7/modular/sortable.esm.js';
import { initI18n, setLanguage, getLanguage, t } from './i18n.js';
import {
  loadState,
  saveState,
  loadCollapsedDays,
  saveCollapsedDays,
  createTrip,
  createDay,
  createStop,
  roundCoordinate,
} from './store.js';
import { createMap, renderTrip, fitStops, flyTo, dayColor, getViewArea } from './map.js';
import { searchPlaces, reversePlace, areaAround } from './geocode.js';
import { el, byId, slugify, downloadBlob } from './dom.js';
import { tripToText, stopToLine, stopsToText, linesToStops } from './textformat.js';
import { openDialog, closeDialog, hint, actions, closeButton, copyText } from './dialog.js';
import { openTextExport, openTextImport, openShareLink } from './transfer.js';
import { createShareUrl, readSharedText } from './share.js';
import { renderTripImage } from './export-image.js';

const STORAGE_NOTICE_KEY = 'followme.storageNoticeDismissed';
const TOAST_DURATION_MS = 6000;

const state = loadState();
const collapsedDayIds = loadCollapsedDays();
let activeDayId = currentTrip().days[0]?.id ?? null;
// giorno mostrato sulla mappa, null = tutti
let visibleDayId = null;
// giorno in modifica come testo: { dayId, draft, message }; il draft sopravvive ai re-render
let textEdit = null;
let toastTimer = null;

const elements = {
  languageToggle: byId('language-toggle'),
  storageNotice: byId('storage-notice'),
  tripSelect: byId('trip-select'),
  tripNew: byId('trip-new'),
  tripDelete: byId('trip-delete'),
  tripTitle: byId('trip-title'),
  searchForm: byId('search-form'),
  searchInput: byId('search-input'),
  searchResults: byId('search-results'),
  status: byId('status'),
  collapseAll: byId('collapse-all'),
  days: byId('days'),
  dayAdd: byId('day-add'),
  dayFilter: byId('day-filter'),
  importText: byId('import-text'),
  exportText: byId('export-text'),
  shareLink: byId('share-link'),
  exportImage: byId('export-image'),
  toast: byId('toast'),
  toastMessage: byId('toast-message'),
  toastUndo: byId('toast-undo'),
};

function currentTrip() {
  return state.trips.find((trip) => trip.id === state.currentId);
}

function save() {
  saveState(state);
}

function showStatus(message) {
  elements.status.textContent = message;
}

function tripLabel(trip) {
  return trip.title || t('trip.untitled');
}

function dayLabel(day, dayIndex) {
  return day.label || t('day.default', { n: dayIndex + 1 });
}

function findStop(stopId) {
  for (const day of currentTrip().days) {
    const index = day.stops.findIndex((stop) => stop.id === stopId);
    if (index !== -1) return { day, index, stop: day.stops[index] };
  }
  return null;
}

function findDay(dayId) {
  return currentTrip().days.find((day) => day.id === dayId);
}

function iconButton(text, title, onclick, className = '') {
  return el('button', { type: 'button', className: `icon-button ${className}`, textContent: text, title, onclick });
}

// --- Rendering ---

/** Ridisegna tutto dopo una modifica strutturale (aggiunte, spostamenti, eliminazioni). */
function refresh() {
  save();
  renderTripBar();
  renderDays();
  renderMap();
}

function renderMap() {
  const trip = currentTrip();
  // con un filtro attivo si vede sempre il giorno selezionato, dove finiscono le nuove tappe
  if (visibleDayId && visibleDayId !== activeDayId) visibleDayId = activeDayId;
  if (!trip.days.some((day) => day.id === visibleDayId)) visibleDayId = null;
  renderDayFilter(trip);
  renderTrip(trip, visibleDayId, { onMove: moveStopPosition, onSelect: focusStop });
}

function renderDayFilter(trip) {
  const chip = (label, dayId, color) => {
    const button = el('button', {
      type: 'button',
      className: 'chip',
      textContent: label,
      onclick: () => showDay(dayId),
    });
    button.classList.toggle('active', dayId === visibleDayId);
    if (color) button.style.setProperty('--day-color', color);
    return button;
  };
  elements.dayFilter.replaceChildren(
    chip(t('day.all'), null),
    ...trip.days.map((day, dayIndex) => chip(dayLabel(day, dayIndex), day.id, dayColor(dayIndex))),
  );
}

/** Mostra sulla mappa un solo giorno (dayId) o tutti (null) e lo inquadra. */
function showDay(dayId) {
  visibleDayId = dayId;
  if (dayId) setActiveDay(dayId);
  renderMap();
  fitStops(visibleStops());
}

function visibleStops() {
  return currentTrip()
    .days.filter((day) => !visibleDayId || day.id === visibleDayId)
    .flatMap((day) => day.stops);
}

function renderTripBar() {
  const trip = currentTrip();
  const nextLanguage = getLanguage() === 'it' ? 'en' : 'it';
  elements.languageToggle.textContent = nextLanguage.toUpperCase();
  elements.languageToggle.dataset.flag = nextLanguage;
  elements.languageToggle.title = t('language.switch');
  elements.languageToggle.setAttribute('aria-label', t('language.switch'));
  elements.tripSelect.replaceChildren(
    ...state.trips.map((item) =>
      el('option', { value: item.id, textContent: tripLabel(item), selected: item.id === trip.id }),
    ),
  );
  elements.tripTitle.value = trip.title;
}

function renderDays() {
  const trip = currentTrip();
  if (!trip.days.some((day) => day.id === activeDayId)) activeDayId = trip.days[0]?.id ?? null;
  if (textEdit && !findDay(textEdit.dayId)) textEdit = null;
  elements.days.replaceChildren(...trip.days.map((day, dayIndex) => renderDay(day, dayIndex)));
  const allCollapsed = trip.days.length > 0 && trip.days.every((day) => collapsedDayIds.has(day.id));
  elements.collapseAll.textContent = t(allCollapsed ? 'day.expandAll' : 'day.collapseAll');
  elements.collapseAll.hidden = trip.days.length < 2;
}

function renderDay(day, dayIndex) {
  const editing = textEdit?.dayId === day.id;
  const collapsed = collapsedDayIds.has(day.id) && !editing;
  const card = el('section', { className: 'day' });
  card.dataset.dayId = day.id;
  card.classList.toggle('active', day.id === activeDayId);
  card.classList.toggle('collapsed', collapsed);
  card.style.setProperty('--day-color', dayColor(dayIndex));
  card.addEventListener('click', () => setActiveDay(day.id));

  const labelInput = el('input', {
    className: 'day-label',
    value: day.label,
    placeholder: t('day.default', { n: dayIndex + 1 }),
    oninput: () => {
      day.label = labelInput.value.trim();
      save();
      renderDayFilter(currentTrip());
    },
  });
  card.append(
    el(
      'header',
      { className: 'day-header' },
      iconButton(collapsed ? '▸' : '▾', t(collapsed ? 'day.expand' : 'day.collapse'), () => toggleCollapsed(day.id)),
      el('span', { className: 'day-dot' }),
      labelInput,
      el('span', { className: 'day-count', textContent: t('day.count', { count: day.stops.length }) }),
      iconButton('✎', t('day.editText'), () => startTextEdit(day)),
      iconButton('×', t('day.delete'), () => deleteDay(day), 'danger'),
    ),
  );
  if (editing) card.append(renderTextEditor());
  else if (!collapsed) card.append(renderStopList(day));
  return card;
}

function renderStopList(day) {
  const list = el('ol', { className: 'stops' }, ...day.stops.map((stop, index) => renderStop(stop, index)));
  list.dataset.dayId = day.id;
  list.dataset.empty = t('day.empty');
  // si trascina dal numero, cosi' tap e scrittura nei campi restano normali
  Sortable.create(list, {
    group: 'stops',
    handle: '.stop-number',
    animation: 150,
    onEnd: ({ from, to, oldIndex, newIndex }) => moveStop(from.dataset.dayId, oldIndex, to.dataset.dayId, newIndex),
  });
  return list;
}

function renderStop(stop, index) {
  const item = el('li', { className: 'stop' });
  item.dataset.stopId = stop.id;
  const nameInput = el('input', {
    className: 'stop-name',
    value: stop.name,
    placeholder: t('stop.unnamed'),
    oninput: () => {
      stop.name = nameInput.value.trim();
      save();
    },
  });
  const timeInput = el('input', {
    type: 'time',
    className: 'stop-time',
    value: stop.time,
    title: t('stop.time'),
    onchange: () => {
      stop.time = timeInput.value;
      save();
    },
  });
  item.append(
    el('span', { className: 'stop-number', textContent: String(index + 1), title: t('stop.drag') }),
    nameInput,
    timeInput,
    iconButton('⋯', t('stop.menu'), () => openStopMenu(stop.id)),
  );
  return item;
}

function renderTextEditor() {
  const area = el('textarea', {
    className: 'day-text',
    value: textEdit.draft,
    rows: Math.max(4, textEdit.draft.split('\n').length + 1),
    placeholder: t('textEdit.placeholder'),
    oninput: () => {
      textEdit.draft = area.value;
    },
  });
  return el(
    'div',
    { className: 'day-editor' },
    hint(t('textEdit.help')),
    area,
    el('p', { className: 'status edit-status', textContent: textEdit.message }),
    actions(
      el('button', { type: 'button', textContent: t('textEdit.cancel'), onclick: cancelTextEdit }),
      el('button', { type: 'button', className: 'primary apply-text', textContent: t('textEdit.apply'), onclick: applyTextEdit }),
    ),
  );
}

// Solo cambio di classe: un re-render toglierebbe il focus all'input appena cliccato
function setActiveDay(dayId) {
  activeDayId = dayId;
  elements.days.querySelectorAll('.day').forEach((card) => {
    card.classList.toggle('active', card.dataset.dayId === dayId);
  });
  if (visibleDayId && visibleDayId !== dayId) renderMap();
}

function focusStop(stopId) {
  const found = findStop(stopId);
  if (!found) return;
  activeDayId = found.day.id;
  if (collapsedDayIds.delete(found.day.id)) {
    saveCollapsedDays(collapsedDayIds);
    renderDays();
  }
  setActiveDay(found.day.id);
  const item = elements.days.querySelector(`[data-stop-id="${stopId}"]`);
  if (!item) return;
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  item.querySelector('.stop-name').focus({ preventScroll: true });
}

function showToast(message, onUndo) {
  clearTimeout(toastTimer);
  elements.toastMessage.textContent = message;
  elements.toastUndo.onclick = () => {
    elements.toast.hidden = true;
    onUndo();
  };
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, TOAST_DURATION_MS);
}

// --- Azioni ---

/** Esegue una modifica distruttiva offrendo "Annulla", che ripristina lo stato precedente. */
function withUndo(message, change) {
  const snapshot = JSON.stringify(state);
  change();
  refresh();
  showToast(message, () => {
    const previous = JSON.parse(snapshot);
    state.trips = previous.trips;
    state.currentId = previous.currentId;
    refresh();
    fitStops(visibleStops());
  });
}

function activeDay() {
  const trip = currentTrip();
  if (trip.days.length === 0) trip.days.push(createDay());
  return trip.days.find((day) => day.id === activeDayId) ?? trip.days[trip.days.length - 1];
}

function addStop(lat, lng, name = '') {
  const day = activeDay();
  const stop = createStop(name, lat, lng);
  day.stops.push(stop);
  activeDayId = day.id;
  if (collapsedDayIds.delete(day.id)) saveCollapsedDays(collapsedDayIds);
  refresh();
  return stop;
}

async function addStopFromMap(lat, lng) {
  const stop = addStop(lat, lng);
  try {
    const name = await reversePlace(lat, lng, getLanguage());
    if (!name || stop.name) return;
    stop.name = name;
    save();
    const input = elements.days.querySelector(`[data-stop-id="${stop.id}"] .stop-name`);
    if (input && !input.value) input.value = name;
  } catch {
    showStatus(t('error.geocode'));
  }
}

function moveStopPosition(stopId, lat, lng) {
  const found = findStop(stopId);
  if (!found) return;
  found.stop.lat = roundCoordinate(lat);
  found.stop.lng = roundCoordinate(lng);
  refresh();
}

function moveStop(fromDayId, oldIndex, toDayId, newIndex) {
  if (fromDayId === toDayId && oldIndex === newIndex) return;
  const [stop] = findDay(fromDayId).stops.splice(oldIndex, 1);
  findDay(toDayId).stops.splice(newIndex, 0, stop);
  activeDayId = toDayId;
  refresh();
}

function moveStopToDay(stopId, dayId) {
  const { day, index, stop } = findStop(stopId);
  day.stops.splice(index, 1);
  findDay(dayId).stops.push(stop);
  activeDayId = dayId;
  refresh();
}

function duplicateStop(stopId, dayId) {
  const { stop } = findStop(stopId);
  findDay(dayId).stops.push({ ...createStop(stop.name, stop.lat, stop.lng), time: stop.time });
  activeDayId = dayId;
  if (collapsedDayIds.delete(dayId)) saveCollapsedDays(collapsedDayIds);
  refresh();
}

function deleteStop(stopId) {
  const { day, index, stop } = findStop(stopId);
  withUndo(t('undo.stopDeleted', { name: stop.name || t('stop.unnamed') }), () => day.stops.splice(index, 1));
}

function deleteDay(day) {
  const trip = currentTrip();
  const label = dayLabel(day, trip.days.indexOf(day));
  withUndo(t('undo.dayDeleted', { name: label }), () => trip.days.splice(trip.days.indexOf(day), 1));
}

function deleteTrip() {
  const trip = currentTrip();
  withUndo(t('undo.tripDeleted', { name: tripLabel(trip) }), () => {
    state.trips.splice(state.trips.indexOf(trip), 1);
    if (state.trips.length === 0) state.trips.push(createTrip());
    state.currentId = state.trips[0].id;
    visibleDayId = null;
  });
  fitStops(visibleStops());
}

function toggleCollapsed(dayId) {
  if (!collapsedDayIds.delete(dayId)) collapsedDayIds.add(dayId);
  saveCollapsedDays(collapsedDayIds);
  renderDays();
}

function toggleCollapseAll() {
  const days = currentTrip().days;
  const allCollapsed = days.every((day) => collapsedDayIds.has(day.id));
  days.forEach((day) => (allCollapsed ? collapsedDayIds.delete(day.id) : collapsedDayIds.add(day.id)));
  saveCollapsedDays(collapsedDayIds);
  renderDays();
}

function openStopMenu(stopId) {
  const { day, stop } = findStop(stopId);
  const trip = currentTrip();
  const status = el('p', { className: 'status' });
  const dayChoices = (onPick, excludedDayId) =>
    el(
      'div',
      { className: 'menu-days' },
      ...trip.days
        .map((target, targetIndex) => ({ target, targetIndex }))
        .filter(({ target }) => target.id !== excludedDayId)
        .map(({ target, targetIndex }) => {
          const button = el('button', {
            type: 'button',
            className: 'chip',
            textContent: dayLabel(target, targetIndex),
            onclick: () => {
              closeDialog();
              onPick(target.id);
            },
          });
          button.style.setProperty('--day-color', dayColor(targetIndex));
          return button;
        }),
    );
  const moveSection = trip.days.length > 1 ? [el('h3', { textContent: t('stop.moveTo') }), dayChoices((dayId) => moveStopToDay(stopId, dayId), day.id)] : [];

  openDialog(
    stop.name || t('stop.unnamed'),
    el('button', {
      type: 'button',
      className: 'menu-item',
      textContent: t('stop.copy'),
      onclick: () => copyText(stopToLine(stop), status, t('stop.copied')),
    }),
    status,
    el('h3', { textContent: t('stop.duplicateTo') }),
    dayChoices((dayId) => duplicateStop(stopId, dayId)),
    ...moveSection,
    actions(
      el('button', {
        type: 'button',
        className: 'danger',
        textContent: t('stop.delete'),
        onclick: () => {
          closeDialog();
          deleteStop(stopId);
        },
      }),
      closeButton(),
    ),
  );
}

// --- Modifica di un giorno come testo ---

function startTextEdit(day) {
  textEdit = { dayId: day.id, draft: stopsToText(day.stops), message: '' };
  renderDays();
  elements.days.querySelector('.day-text')?.focus();
}

function cancelTextEdit() {
  textEdit = null;
  renderDays();
}

function setEditStatus(message) {
  textEdit.message = message;
  const node = elements.days.querySelector('.edit-status');
  if (node) node.textContent = message;
}

/**
 * Applica il testo: righe rinumerate, tappe senza coordinate cercate per nome nella zona del viaggio.
 * Se qualcuna non si trova il testo resta aperto, con le coordinate gia' trovate aggiunte.
 */
async function applyTextEdit() {
  const edit = textEdit;
  const stops = linesToStops(edit.draft);
  const missing = stops.filter((stop) => stop.lat === null);
  const area = areaAround([...currentTrip().days.flatMap((day) => day.stops), ...stops]);
  const applyButton = elements.days.querySelector('.apply-text');
  if (applyButton) applyButton.disabled = true;
  try {
    for (const [index, stop] of missing.entries()) {
      setEditStatus(t('import.geocoding', { name: stop.name, current: index + 1, total: missing.length }));
      const [place] = await searchPlaces(stop.name, getLanguage(), area);
      if (place) Object.assign(stop, { lat: place.lat, lng: place.lng });
    }
  } catch {
    setEditStatus(t('error.geocode'));
    return;
  } finally {
    const button = elements.days.querySelector('.apply-text');
    if (button) button.disabled = false;
  }
  // il giorno potrebbe essere stato eliminato o la modifica annullata durante la ricerca
  const day = findDay(edit.dayId);
  if (textEdit !== edit || !day) return;

  const notFound = stops.filter((stop) => stop.lat === null);
  if (notFound.length) {
    edit.draft = stopsToText(stops);
    edit.message = t('textEdit.notFound', { names: notFound.map((stop) => stop.name).join(', ') });
    renderDays();
    return;
  }
  withUndo(t('undo.dayEdited', { name: dayLabel(day, currentTrip().days.indexOf(day)) }), () => {
    day.stops = stops.map((stop) => ({ ...createStop(stop.name, stop.lat, stop.lng), time: stop.time }));
    textEdit = null;
  });
}

// --- Ricerca, import, export ---

async function onSearch(event) {
  event.preventDefault();
  const text = elements.searchInput.value.trim();
  if (!text) return;
  elements.searchResults.replaceChildren();
  showStatus(t('search.searching'));
  try {
    const places = await searchPlaces(text, getLanguage(), getViewArea());
    showStatus(places.length ? '' : t('search.noResults'));
    elements.searchResults.replaceChildren(
      ...places.map((place) =>
        el(
          'li',
          {},
          el(
            'button',
            { type: 'button', className: 'search-result', onclick: () => pickPlace(place) },
            el('strong', { textContent: place.name }),
            el('span', { textContent: place.description }),
          ),
        ),
      ),
    );
  } catch {
    showStatus(t('error.geocode'));
  }
}

function pickPlace(place) {
  addStop(place.lat, place.lng, place.name);
  elements.searchResults.replaceChildren();
  elements.searchInput.value = '';
  flyTo(place.lat, place.lng);
}

function switchTrip(tripId) {
  state.currentId = tripId;
  activeDayId = currentTrip().days[0]?.id ?? null;
  visibleDayId = null;
  textEdit = null;
  refresh();
  fitStops(visibleStops());
}

function currentTripText() {
  return tripToText(currentTrip(), { untitled: t('trip.untitled'), dayName: (n) => t('day.default', { n }) });
}

/** Crea un nuovo viaggio da quello letto dal testo, saltando le tappe senza coordinate. */
function importTrip(parsed) {
  const trip = createTrip();
  trip.title = parsed.title;
  const days = parsed.days.map((parsedDay) => ({
    ...createDay(),
    label: parsedDay.label,
    stops: parsedDay.stops
      .filter((stop) => stop.lat !== null)
      .map((stop) => ({ ...createStop(stop.name, stop.lat, stop.lng), time: stop.time })),
  }));
  if (days.length) trip.days = days;
  // con piu' giorni la lista parte compressa, si apre il giorno che interessa
  if (trip.days.length > 1) {
    trip.days.forEach((day) => collapsedDayIds.add(day.id));
    saveCollapsedDays(collapsedDayIds);
  }
  // un viaggio corrente ancora vuoto (es. quello creato al primo avvio) viene sostituito
  const current = currentTrip();
  const isEmpty = !current.title && current.days.every((day) => day.stops.length === 0);
  if (isEmpty) state.trips.splice(state.trips.indexOf(current), 1);
  state.trips.push(trip);
  switchTrip(trip.id);
}

function openImageExport() {
  const status = el('p', { className: 'status' });
  const formatButton = (format) =>
    el('button', { type: 'button', className: 'primary', textContent: t(`image.${format}`), onclick: () => exportImage(format, status) });
  openDialog(
    t('image.title'),
    hint(t(visibleDayId ? 'image.helpDay' : 'image.helpAll')),
    status,
    actions(formatButton('square'), formatButton('portrait'), closeButton()),
  );
}

/** Scarica il PNG del viaggio (solo il giorno filtrato, se c'e' un filtro). */
async function exportImage(format, status) {
  const trip = currentTrip();
  const days = trip.days
    .map((day, dayIndex) => ({ day, dayIndex }))
    .filter(({ day }) => day.stops.length && (!visibleDayId || day.id === visibleDayId))
    .map(({ day, dayIndex }) => ({
      label: dayLabel(day, dayIndex),
      color: dayColor(dayIndex),
      stops: day.stops.map((stop) => ({ ...stop, name: stop.name || t('stop.unnamed') })),
    }));
  if (days.length === 0) {
    status.textContent = t('image.empty');
    return;
  }
  status.textContent = t('image.working');
  try {
    const blob = await renderTripImage({ title: tripLabel(trip), format, days });
    downloadBlob(blob, `${slugify(trip.title)}.png`);
    status.textContent = t('image.done');
  } catch (error) {
    console.error(error);
    status.textContent = t('image.error');
  }
}

async function openSharedTrip() {
  try {
    const text = await readSharedText();
    if (text) openTextImport({ text, notice: t('share.received'), onImport: importTrip });
  } catch {
    showStatus(t('share.invalid'));
  }
}

/**
 * Safari cancella i dati dei siti non usati per 7 giorni, salvo app installate:
 * avviso finche' lo spazio non e' persistente o l'utente non lo chiude.
 */
async function checkStorage() {
  if (localStorage.getItem(STORAGE_NOTICE_KEY)) return;
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  if (installed || persisted) return;
  const text = el('span', { textContent: t('storage.notice') });
  text.dataset.i18n = 'storage.notice';
  const dismiss = el('button', {
    type: 'button',
    textContent: t('storage.dismiss'),
    onclick: () => {
      // la richiesta parte da un click: su Firefox mostra un permesso, non va fatta all'avvio
      navigator.storage?.persist?.().catch(() => {});
      localStorage.setItem(STORAGE_NOTICE_KEY, '1');
      elements.storageNotice.hidden = true;
    },
  });
  dismiss.dataset.i18n = 'storage.dismiss';
  elements.storageNotice.replaceChildren(text, dismiss);
  elements.storageNotice.hidden = false;
}

// --- Avvio ---

await initI18n();
createMap(byId('map'), addStopFromMap);

elements.languageToggle.addEventListener('click', async () => {
  await setLanguage(getLanguage() === 'it' ? 'en' : 'it');
  refresh();
});
elements.tripSelect.addEventListener('change', () => switchTrip(elements.tripSelect.value));
elements.tripNew.addEventListener('click', () => {
  const trip = createTrip();
  state.trips.push(trip);
  switchTrip(trip.id);
  elements.tripTitle.focus();
});
elements.tripDelete.addEventListener('click', deleteTrip);
elements.tripTitle.addEventListener('input', () => {
  const trip = currentTrip();
  trip.title = elements.tripTitle.value.trim();
  save();
  elements.tripSelect.selectedOptions[0].textContent = tripLabel(trip);
});
elements.searchForm.addEventListener('submit', onSearch);
elements.collapseAll.addEventListener('click', toggleCollapseAll);
elements.shareLink.addEventListener('click', async () => {
  openShareLink(await createShareUrl(currentTripText()), tripLabel(currentTrip()));
});
elements.exportImage.addEventListener('click', openImageExport);
// link incollato con l'app gia' aperta: cambia solo l'hash, senza ricaricare
window.addEventListener('hashchange', openSharedTrip);
elements.importText.addEventListener('click', () => openTextImport({ onImport: importTrip }));
elements.exportText.addEventListener('click', () => {
  openTextExport(currentTripText(), `${slugify(currentTrip().title)}.txt`);
});
elements.dayAdd.addEventListener('click', () => {
  const day = createDay();
  currentTrip().days.push(day);
  activeDayId = day.id;
  refresh();
});

refresh();
fitStops(visibleStops());
openSharedTrip();
checkStorage();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
