// Export PNG in formato fisso per i social: titolo, mappa, elenco tappe, attribuzione
import { createSnapshotMap } from './map.js';

export const IMAGE_FORMATS = { square: { width: 1080, height: 1080 }, portrait: { width: 1080, height: 1350 } };

// Richiesta dalle licenze di OpenStreetMap e OpenMapTiles
const ATTRIBUTION = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TEXT_COLOR = '#1d2330';
const MUTED_COLOR = '#687185';
// la mappa e' generata a meta' risoluzione CSS con pixelRatio 2: etichette leggibili a 1080px
const PIXEL_RATIO = 2;

const PADDING = 40;
const HEADER_HEIGHT = 112;
const FOOTER_HEIGHT = 50;
const LIST_GAP = 24;
const COLUMN_GAP = 40;
const HEADING_HEIGHT = 46;
const ROW_HEIGHT = 38;
const MIN_MAP_SHARE = 0.5;

/**
 * Compone l'immagine. I marker della mappa vengono disegnati qui, nelle posizioni della mappa fuori schermo.
 * @param {{title: string, format: string,
 *   days: {label: string, color: string, stops: {name: string, time: string, lat: number, lng: number}[]}[]}} content
 * @returns {Promise<Blob>}
 */
export async function renderTripImage({ title, format, days }) {
  const { width, height } = IMAGE_FORMATS[format];
  const columnWidth = (width - 2 * PADDING - COLUMN_GAP) / 2;
  const columns = splitInColumns(listRows(days));
  const listHeight = Math.max(0, ...columns.map(columnHeight));
  const listBlock = listHeight ? listHeight + LIST_GAP : 0;
  // con molte tappe la mappa non scende sotto meta' larghezza: l'immagine si allunga
  const mapHeight = Math.max(height - HEADER_HEIGHT - listBlock - FOOTER_HEIGHT, Math.round(width * MIN_MAP_SHARE));
  const snapshot = await createSnapshotMap({
    width: width / PIXEL_RATIO,
    height: Math.round(mapHeight / PIXEL_RATIO),
    pixelRatio: PIXEL_RATIO,
    days,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = HEADER_HEIGHT + mapHeight + listBlock + FOOTER_HEIGHT;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'middle';

  context.fillStyle = TEXT_COLOR;
  context.font = `600 44px ${FONT_FAMILY}`;
  context.fillText(fitText(context, title, width - 2 * PADDING), PADDING, PADDING + 28);

  try {
    context.drawImage(snapshot.canvas, 0, HEADER_HEIGHT, width, mapHeight);
    context.save();
    context.beginPath();
    context.rect(0, HEADER_HEIGHT, width, mapHeight);
    context.clip();
    for (const day of days) {
      day.stops.forEach((stop, index) => {
        const point = snapshot.project(stop.lng, stop.lat);
        drawBadge(context, point.x * PIXEL_RATIO, HEADER_HEIGHT + point.y * PIXEL_RATIO, 22, day.color, index + 1);
      });
    }
    context.restore();
  } finally {
    snapshot.remove();
  }

  const listTop = HEADER_HEIGHT + mapHeight + LIST_GAP;
  columns.forEach((rows, columnIndex) => {
    let y = listTop;
    const x = PADDING + columnIndex * (columnWidth + COLUMN_GAP);
    for (const row of rows) {
      drawRow(context, row, x, y, columnWidth);
      y += row.height;
    }
  });

  context.fillStyle = MUTED_COLOR;
  context.font = `20px ${FONT_FAMILY}`;
  context.textAlign = 'right';
  context.fillText(ATTRIBUTION, width - PADDING, canvas.height - FOOTER_HEIGHT / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob fallito'))), 'image/png');
  });
}

function listRows(days) {
  return days.flatMap((day) => [
    { type: 'heading', day, height: HEADING_HEIGHT },
    ...day.stops.map((stop, index) => ({ type: 'stop', day, stop, number: index + 1, height: ROW_HEIGHT })),
  ]);
}

// Due colonne di altezza simile, senza lasciare un titolo di giorno in fondo alla prima
function splitInColumns(rows) {
  const total = rows.reduce((sum, row) => sum + row.height, 0);
  let used = 0;
  let splitAt = rows.length;
  for (const [index, row] of rows.entries()) {
    if (used >= total / 2) {
      splitAt = index;
      break;
    }
    used += row.height;
  }
  if (rows[splitAt - 1]?.type === 'heading') splitAt -= 1;
  return [rows.slice(0, splitAt), rows.slice(splitAt)].filter((column) => column.length);
}

function columnHeight(rows) {
  return rows.reduce((sum, row) => sum + row.height, 0);
}

function drawRow(context, row, x, y, maxWidth) {
  const centerY = y + row.height / 2;
  if (row.type === 'heading') {
    context.fillStyle = row.day.color;
    context.beginPath();
    context.arc(x + 10, centerY, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = TEXT_COLOR;
    context.font = `600 26px ${FONT_FAMILY}`;
    context.textAlign = 'left';
    context.fillText(fitText(context, row.day.label, maxWidth - 32), x + 32, centerY);
    return;
  }
  drawBadge(context, x + 15, centerY, 15, row.day.color, row.number);
  const text = [row.stop.time, row.stop.name].filter(Boolean).join('  ');
  context.fillStyle = TEXT_COLOR;
  context.font = `24px ${FONT_FAMILY}`;
  context.textAlign = 'left';
  context.fillText(fitText(context, text, maxWidth - 42), x + 42, centerY);
}

function drawBadge(context, centerX, centerY, radius, color, number) {
  context.fillStyle = color;
  context.strokeStyle = '#ffffff';
  context.lineWidth = Math.max(2, radius / 6);
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#ffffff';
  context.font = `600 ${Math.round(radius * 1.05)}px ${FONT_FAMILY}`;
  context.textAlign = 'center';
  context.fillText(String(number), centerX, centerY + 1);
}

function fitText(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && context.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
}
