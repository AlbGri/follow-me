// Formato testo leggibile, vedi CLAUDE.md. Il parser riconosce i simboli, non le parole.
const TITLE = /^#(?!#)\s*(.+)$/;
const DAY = /^##\s*(.*)$/;
const STOP = /^(?:\d+[.)]|[-*•])\s+(.+)$/;
const TIME = /^(\d{1,2})[:.](\d{2})(?:\s+(.*))?$/;
const COORDINATES = /\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/;
// "Giorno 2 - Gozo", "Day 2: Gozo", "2 - Gozo" -> "Gozo": parola + numero iniziali sono il nome di default
const DAY_PREFIX = /^(?:\S+\s+)?\d+\s*(?:[-–:]\s*(.*))?$/;

/**
 * Converte un viaggio in testo.
 * @param {object} trip viaggio del modello (store.js)
 * @param {{untitled: string, dayName: (n: number) => string}} names testi di default localizzati
 */
export function tripToText(trip, { untitled, dayName }) {
  const lines = [`# ${trip.title || untitled}`];
  trip.days.forEach((day, dayIndex) => {
    const name = dayName(dayIndex + 1);
    lines.push('', day.label ? `## ${name} - ${day.label}` : `## ${name}`);
    day.stops.forEach((stop, stopIndex) => {
      const parts = [`${stopIndex + 1}.`, stop.time, stop.name, `(${formatCoordinate(stop.lat)}, ${formatCoordinate(stop.lng)})`];
      lines.push(parts.filter(Boolean).join(' '));
    });
  });
  return `${lines.join('\n')}\n`;
}

/**
 * Legge un viaggio dal testo. Le righe non riconosciute vengono ignorate.
 * Le tappe senza coordinate hanno lat/lng null.
 * @returns {{title: string, days: {label: string, stops: {name: string, time: string, lat: ?number, lng: ?number}[]}[]}}
 */
export function textToTrip(text) {
  const trip = { title: '', days: [] };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const day = line.match(DAY);
    const title = line.match(TITLE);
    const stop = line.match(STOP);
    if (day) {
      trip.days.push({ label: parseDayLabel(day[1].trim()), stops: [] });
    } else if (title) {
      trip.title ||= title[1].trim();
    } else if (stop) {
      if (trip.days.length === 0) trip.days.push({ label: '', stops: [] });
      trip.days.at(-1).stops.push(parseStop(stop[1]));
    }
  }
  return trip;
}

function parseDayLabel(text) {
  const prefix = text.match(DAY_PREFIX);
  return prefix ? (prefix[1] ?? '').trim() : text;
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
