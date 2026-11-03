// Date dei giorni: data di inizio del viaggio + posizione del giorno.
// Tutto in UTC, cosi' il cambio dell'ora legale non fa saltare o ripetere un giorno.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_FIRST_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;
const LOCALES = { it: 'it-IT', en: 'en-GB' };

function utcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return valid ? date : null;
}

/**
 * Legge una data "2026-10-31", "31-10-2026" o "31/10/2026" (sempre giorno-mese-anno).
 * @returns {string} data ISO "YYYY-MM-DD", o stringa vuota se non valida
 */
export function parseDate(text) {
  const iso = text.match(ISO_DATE);
  const dayFirst = text.match(DAY_FIRST_DATE);
  const date = iso
    ? utcDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
    : dayFirst && utcDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
  return date ? date.toISOString().slice(0, 10) : '';
}

/** Data ISO del giorno in posizione dayIndex (da 0), o stringa vuota senza data di inizio. */
export function dayIsoDate(startDate, dayIndex) {
  if (!startDate) return '';
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayIndex);
  return date.toISOString().slice(0, 10);
}

/** Data di inizio tale che il giorno dayIndex cada in isoDate. */
export function startDateFor(isoDate, dayIndex) {
  return dayIsoDate(isoDate, -dayIndex);
}

const STYLES = {
  short: { month: 'short' },
  long: { month: 'long' },
  full: { month: 'long', year: 'numeric' },
};

/** "sab 31 ott" (short), "sab 31 ottobre" (long) o "sab 31 ottobre 2026" (full) nella lingua dell'interfaccia. */
export function formatDate(isoDate, language, style = 'short') {
  if (!isoDate) return '';
  const format = new Intl.DateTimeFormat(LOCALES[language] ?? language, {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...STYLES[style],
  });
  return format.format(new Date(`${isoDate}T00:00:00Z`)).replace(',', '');
}

const normalizeMonth = (name) => name.toLowerCase().replace(/\./g, '');

// Nomi dei mesi (completi e abbreviati) in tutte le lingue dell'interfaccia, per leggere "31 ottobre 2026"
const MONTHS = new Map();
for (const locale of Object.values(LOCALES)) {
  for (const month of ['long', 'short']) {
    const format = new Intl.DateTimeFormat(locale, { month, timeZone: 'UTC' });
    for (let index = 1; index <= 12; index++) {
      MONTHS.set(normalizeMonth(format.format(new Date(Date.UTC(2026, index - 1, 1)))), index);
    }
  }
}

/** Data ISO da giorno, nome del mese e anno ("31", "ottobre", "2026"), o stringa vuota. */
export function parseWrittenDate(day, monthName, year) {
  const month = MONTHS.get(normalizeMonth(monthName));
  if (!month) return '';
  return parseDate(`${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`);
}

/** Giorni tra due date ISO. */
export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}
