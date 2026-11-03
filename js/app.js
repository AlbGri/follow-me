import { initI18n, setLanguage, getLanguage, t } from './i18n.js';
import { loadState, saveState, createTrip, createDay, createStop, roundCoordinate } from './store.js';
import { createMap, renderTrip, fitStops, flyTo, dayColor } from './map.js';
import { searchPlaces, reversePlace } from './geocode.js';
import { el, byId, slugify, downloadBlob } from './dom.js';
import { tripToText } from './textformat.js';
import { openTextExport, openTextImport, openShareLink } from './transfer.js';
import { createShareUrl, readSharedText } from './share.js';
import { renderTripImage } from './export-image.js';

const state = loadState();
let activeDayId = currentTrip().days[0]?.id ?? null;
// giorno mostrato sulla mappa, null = tutti
let visibleDayId = null;

const elements = {
  languageToggle: byId('language-toggle'),
  tripSelect: byId('trip-select'),
  tripNew: byId('trip-new'),
  tripDelete: byId('trip-delete'),
  tripTitle: byId('trip-title'),
  searchForm: byId('search-form'),
  searchInput: byId('search-input'),
  searchResults: byId('search-results'),
  status: byId('status'),
  days: byId('days'),
  dayAdd: byId('day-add'),
  dayFilter: byId('day-filter'),
  importText: byId('import-text'),
  exportText: byId('export-text'),
  shareLink: byId('share-link'),
  exportImage: byId('export-image'),
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
  elements.languageToggle.textContent = t('language.switch');
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
  elements.days.replaceChildren(...trip.days.map((day, dayIndex) => renderDay(trip, day, dayIndex)));
}

function renderDay(trip, day, dayIndex) {
  const card = el('section', { className: 'day' });
  card.dataset.dayId = day.id;
  card.classList.toggle('active', day.id === activeDayId);
  card.style.setProperty('--day-color', dayColor(dayIndex));
  card.addEventListener('click', () => setActiveDay(day.id));

  const labelInput = el('input', {
    className: 'day-label',
    value: day.label,
    placeholder: t('day.default', { n: dayIndex + 1 }),
    oninput: () => {
      day.label = labelInput.value.trim();
      save();
      elements.days.querySelectorAll(`option[value="${day.id}"]`).forEach((option) => {
        option.textContent = dayLabel(day, dayIndex);
      });
    },
  });
  const deleteButton = el('button', {
    type: 'button',
    className: 'icon-button danger',
    textContent: '×',
    title: t('day.delete'),
    onclick: (event) => {
      event.stopPropagation();
      deleteDay(day);
    },
  });

  const stops = day.stops.length
    ? el('ol', { className: 'stops' }, ...day.stops.map((stop, index) => renderStop(trip, day, stop, index)))
    : el('p', { className: 'day-empty', textContent: t('day.empty') });

  card.append(el('header', { className: 'day-header' }, el('span', { className: 'day-dot' }), labelInput, deleteButton), stops);
  return card;
}

function renderStop(trip, day, stop, index) {
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
  const daySelect = el(
    'select',
    {
      className: 'stop-day',
      title: t('stop.moveToDay'),
      onchange: () => moveStopToDay(stop.id, daySelect.value),
    },
    ...trip.days.map((option, optionIndex) =>
      el('option', { value: option.id, textContent: dayLabel(option, optionIndex), selected: option.id === day.id }),
    ),
  );
  const button = (text, title, onclick, disabled = false) =>
    el('button', { type: 'button', className: 'icon-button', textContent: text, title, onclick, disabled });

  item.append(
    el('span', { className: 'stop-number', textContent: String(index + 1) }),
    nameInput,
    button('×', t('stop.delete'), () => deleteStop(stop.id)),
    el(
      'div',
      { className: 'stop-controls' },
      timeInput,
      daySelect,
      button('↑', t('stop.up'), () => shiftStop(stop.id, -1), index === 0),
      button('↓', t('stop.down'), () => shiftStop(stop.id, 1), index === day.stops.length - 1),
    ),
  );
  return item;
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
  setActiveDay(found.day.id);
  const item = elements.days.querySelector(`[data-stop-id="${stopId}"]`);
  item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  item.querySelector('.stop-name').focus({ preventScroll: true });
}

// --- Azioni ---

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

function shiftStop(stopId, offset) {
  const { day, index, stop } = findStop(stopId);
  day.stops.splice(index, 1);
  day.stops.splice(index + offset, 0, stop);
  refresh();
}

function moveStopToDay(stopId, dayId) {
  const { day, index, stop } = findStop(stopId);
  day.stops.splice(index, 1);
  currentTrip().days.find((target) => target.id === dayId).stops.push(stop);
  activeDayId = dayId;
  refresh();
}

function deleteStop(stopId) {
  const { day, index } = findStop(stopId);
  day.stops.splice(index, 1);
  refresh();
}

function deleteDay(day) {
  if (day.stops.length && !confirm(t('day.deleteConfirm', { count: day.stops.length }))) return;
  const trip = currentTrip();
  trip.days.splice(trip.days.indexOf(day), 1);
  refresh();
}

function switchTrip(tripId) {
  state.currentId = tripId;
  activeDayId = currentTrip().days[0]?.id ?? null;
  visibleDayId = null;
  refresh();
  fitStops(visibleStops());
}

async function onSearch(event) {
  event.preventDefault();
  const text = elements.searchInput.value.trim();
  if (!text) return;
  elements.searchResults.replaceChildren();
  showStatus(t('search.searching'));
  try {
    const places = await searchPlaces(text, getLanguage());
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
  // un viaggio corrente ancora vuoto (es. quello creato al primo avvio) viene sostituito
  const current = currentTrip();
  const isEmpty = !current.title && current.days.every((day) => day.stops.length === 0);
  if (isEmpty) state.trips.splice(state.trips.indexOf(current), 1);
  state.trips.push(trip);
  switchTrip(trip.id);
}

/** Scarica il PNG di cio' che si vede sulla mappa (rispetta il filtro giorni). */
async function exportImage() {
  const trip = currentTrip();
  showStatus(t('image.working'));
  try {
    const days = trip.days
      .map((day, dayIndex) => ({ day, dayIndex }))
      .filter(({ day }) => day.stops.length && (!visibleDayId || day.id === visibleDayId))
      .map(({ day, dayIndex }) => ({ label: dayLabel(day, dayIndex), color: dayColor(dayIndex), stops: day.stops }));
    const blob = await renderTripImage({ title: tripLabel(trip), days });
    downloadBlob(blob, `${slugify(trip.title)}.png`);
    showStatus('');
  } catch (error) {
    console.error(error);
    showStatus(t('image.error'));
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

function pickPlace(place) {
  addStop(place.lat, place.lng, place.name);
  elements.searchResults.replaceChildren();
  elements.searchInput.value = '';
  flyTo(place.lat, place.lng);
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
elements.tripDelete.addEventListener('click', () => {
  const trip = currentTrip();
  if (!confirm(t('trip.deleteConfirm', { title: tripLabel(trip) }))) return;
  state.trips.splice(state.trips.indexOf(trip), 1);
  if (state.trips.length === 0) state.trips.push(createTrip());
  switchTrip(state.trips[0].id);
});
elements.tripTitle.addEventListener('input', () => {
  const trip = currentTrip();
  trip.title = elements.tripTitle.value.trim();
  save();
  elements.tripSelect.selectedOptions[0].textContent = tripLabel(trip);
});
elements.searchForm.addEventListener('submit', onSearch);
elements.shareLink.addEventListener('click', async () => {
  openShareLink(await createShareUrl(currentTripText()), tripLabel(currentTrip()));
});
elements.exportImage.addEventListener('click', exportImage);
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
