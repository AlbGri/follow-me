// Formato testo leggibile, vedi CLAUDE.md. Il parser riconosce i simboli, non le parole.
import { parseDate, dayIsoDate, startDateFor } from './dates.js';

const TITLE = /^#(?!#)\s*(.+)$/;
const DAY = /^##\s*(.*)$/;
const STOP = /^(?:\d+[.)]|[-*•])\s+(.+)$/;
const LINE_PREFIX = /^(?:\d+[.)]|[-*•])\s*/;
const TIME = /^(\d{1,2})[:.](\d{2})(?:\s+(.*))?$/;
const COORDINATES = /\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/;
// "Giorno 2 - Gozo", "Day 2: Gozo", "2 - Gozo" -> "Gozo": parola + numero iniziali sono il nome di default
const DAY_PREFIX = /^(?:\S+\s+)?\d+\s*(?:[-–:]\s*(.*))?$/;
// "2026-10-31 - Gozo", "31/10/2026: Gozo": la data al posto del nome di default
const DAY_DATE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*(?:[-–:,]\s*(.*))?$/;

/**
 * Converte un viaggio in testo. Con la data di inizio i giorni si chiamano con la loro data ISO,
 * l'unico formato che non si confonde tra lingue.
 * @param {object} trip viaggio del modello (store.js)
 * @param {{untitled: string, dayName: (n: number) => string}} names testi di default localizzati
 */
export function tripToText(trip, { untitled, dayName }) {
  const lines = [`# ${trip.title || untitled}`];
  trip.days.forEach((day, dayIndex) => {
    const name = dayIsoDate(trip.startDate, dayIndex) || dayName(dayIndex + 1);
    lines.push('', day.label ? `## ${name} - ${day.label}` : `## ${name}`);
    if (day.stops.length) lines.push(stopsToText(day.stops));
  });
  return `${lines.join('\n')}\n`;
}

/** Una tappa come riga senza numero: "09:00 Nome (lat, lng)". Coordinate omesse se assenti. */
export function stopToLine(stop) {
  const coordinates = stop.lat === null ? '' : `(${formatCoordinate(stop.lat)}, ${formatCoordinate(stop.lng)})`;
  return [stop.time, stop.name, coordinates].filter(Boolean).join(' ');
}

/** Tappe come righe numerate. */
export function stopsToText(stops) {
  return stops.map((stop, index) => `${index + 1}. ${stopToLine(stop)}`).join('\n');
}

/**
 * Tappe di un singolo giorno: ogni riga non vuota e' una tappa, numero o trattino iniziali opzionali
 * (la numerazione viene comunque rifatta). Le righe che iniziano con # sono ignorate.
 */
export function linesToStops(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => parseStop(line.replace(LINE_PREFIX, '')))
    .filter((stop) => stop.name || stop.lat !== null);
}

/**
 * Legge un viaggio dal testo. Le righe non riconosciute vengono ignorate.
 * Le tappe senza coordinate hanno lat/lng null.
 * La data di inizio viene dal primo giorno con una data; le date successive seguono la posizione.
 * @returns {{title: string, startDate: string,
 *   days: {label: string, stops: {name: string, time: string, lat: ?number, lng: ?number}[]}[]}}
 */
export function textToTrip(text) {
  const trip = { title: '', startDate: '', days: [] };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const day = line.match(DAY);
    const title = line.match(TITLE);
    const stop = line.match(STOP);
    if (day) {
      const { label, date } = parseDayHeader(day[1].trim());
      if (date && !trip.startDate) trip.startDate = startDateFor(date, trip.days.length);
      trip.days.push({ label, stops: [] });
    } else if (title) {
      trip.title ||= title[1].trim();
    } else if (stop) {
      if (trip.days.length === 0) trip.days.push({ label: '', stops: [] });
      trip.days.at(-1).stops.push(parseStop(stop[1]));
    }
  }
  return trip;
}

function parseDayHeader(text) {
  const dated = text.match(DAY_DATE);
  const date = dated ? parseDate(dated[1]) : '';
  if (date) return { label: (dated[2] ?? '').trim(), date };
  const prefix = text.match(DAY_PREFIX);
  return { label: prefix ? (prefix[1] ?? '').trim() : text, date: '' };
}

function parseStop(text) {
  let name = text;
  let time = '';
  let lat = null;
  let lng = null;

  const coordinates = name.match(COORDINATES);
  if (coordinates) {
    const parsedLat = Number(coordinates[1]);
    const parsedLng = Number(coordinates[2]);
    if (Math.abs(parsedLat) <= 90 && Math.abs(parsedLng) <= 180) {
      lat = parsedLat;
      lng = parsedLng;
      name = name.slice(0, coordinates.index);
    }
  }

  const timeMatch = name.match(TIME);
  if (timeMatch && Number(timeMatch[1]) < 24 && Number(timeMatch[2]) < 60) {
    time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    name = timeMatch[3] ?? '';
  }

  return { name: name.trim(), time, lat, lng };
}

// 4 decimali = circa 10 metri: sufficiente e piu' corto da condividere
function formatCoordinate(value) {
  return String(Number(value.toFixed(4)));
}
