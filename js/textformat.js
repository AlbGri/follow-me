// Formato testo leggibile, vedi CLAUDE.md. Il parser riconosce i simboli, non le parole.
import { parseDate, parseWrittenDate, dayIsoDate, startDateFor, daysBetween } from './dates.js';

const TITLE = /^#(?!#)\s*(.+)$/;
const DAY = /^##\s*(.*)$/;
const STOP = /^(?:\d+[.)]|[-*•])\s+(.+)$/;
const LINE_PREFIX = /^(?:\d+[.)]|[-*•])\s*/;
const TIME = /^(\d{1,2})[:.](\d{2})(?:\s+(.*))?$/;
const COORDINATES = /\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/;
// "Giorno 2 - Gozo", "Day 2: Gozo", "2 · Gozo" -> "Gozo": parola + numero iniziali sono il nome di default
const DAY_PREFIX = /^(?:\S+\s+)?\d+\s*(?:[-–:·]\s*(.*))?$/;
// "2026-10-31 - Gozo", "31/10/2026: Gozo": la data al posto del nome di default
const DAY_DATE = /^(\d{4}-\d{2}-\d{2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*(?:[-–:,·]\s*(.*))?$/;
// "SAB 31 OTTOBRE 2026 · Gozo", "Sat 31 Oct 2026 - Gozo": data scritta del formato da condividere
const WRITTEN_DATE = /^(?:\p{L}+\.?,?\s+)?(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})\s*(?:[-–:,·]\s*(.*))?$/u;
const SHARE_SEPARATOR = ' · ';

/**
 * Testo da condividere (post, messaggi): niente simboli ne' coordinate, titoli in maiuscolo,
 * giorni vuoti omessi. Le date sono scritte per esteso con l'anno, cosi' si reimporta senza slittamenti.
 * @param {{untitled: string, dayName: (n: number) => string, dayDate: (dayIndex: number) => string}} names
 *   dayDate restituisce la data estesa con anno, o stringa vuota
 */
export function tripToShareText(trip, { untitled, dayName, dayDate }) {
  const lines = [(trip.title || untitled).toUpperCase()];
  trip.days.forEach((day, dayIndex) => {
    if (day.stops.length === 0) return;
    const heading = (dayDate(dayIndex) || dayName(dayIndex + 1)).toUpperCase();
    lines.push('', day.label ? `${heading}${SHARE_SEPARATOR}${day.label}` : heading);
    day.stops.forEach((stop, index) => lines.push(`${index + 1}. ${[stop.time, stop.name].filter(Boolean).join(' ')}`));
  });
  return `${lines.join('\n')}\n`;
}

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
 * Legge un viaggio dal testo, in entrambi i formati (con simboli o da condividere).
 * Senza simboli: una riga libera seguita da tappe e' un giorno, la prima riga libera del testo il titolo;
 * le altre righe libere vengono ignorate. Le tappe senza coordinate hanno lat/lng null.
 * La data di inizio viene dal primo giorno con una data; un giorno datato piu' avanti della sua
 * posizione riceve prima i giorni vuoti mancanti (il formato da condividere li omette).
 * @returns {{title: string, startDate: string,
 *   days: {label: string, stops: {name: string, time: string, lat: ?number, lng: ?number}[]}[]}}
 */
export function textToTrip(text) {
  const trip = { title: '', startDate: '', days: [] };
  let freeLine = '';

  const addDay = (header) => {
    const { label, date } = parseDayHeader(header);
    if (date && !trip.startDate) trip.startDate = startDateFor(date, trip.days.length);
    if (date) {
      while (trip.days.length < daysBetween(trip.startDate, date)) trip.days.push({ label: '', stops: [] });
    }
    trip.days.push({ label, stops: [] });
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const day = line.match(DAY);
    const title = line.match(TITLE);
    const stop = line.match(STOP);
    if (day) {
      addDay(day[1].trim());
      freeLine = '';
    } else if (title) {
      trip.title ||= title[1].trim();
      freeLine = '';
    } else if (stop) {
      if (freeLine) addDay(freeLine);
      else if (trip.days.length === 0) trip.days.push({ label: '', stops: [] });
      freeLine = '';
      trip.days.at(-1).stops.push(parseStop(stop[1]));
    } else {
      if (freeLine && !trip.title && trip.days.length === 0) trip.title = freeLine;
      freeLine = line;
    }
  }
  return trip;
}

function parseDayHeader(text) {
  const dated = text.match(DAY_DATE);
  const date = dated ? parseDate(dated[1]) : '';
  if (date) return { label: (dated[2] ?? '').trim(), date };
  const written = text.match(WRITTEN_DATE);
  const writtenDate = written ? parseWrittenDate(written[1], written[2], written[3]) : '';
  if (writtenDate) return { label: (written[4] ?? '').trim(), date: writtenDate };
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
