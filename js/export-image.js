// Export PNG della vista corrente: titolo e legenda sopra, mappa, attribuzione sotto
import { getMap } from './map.js';

// Richiesta dalle licenze di OpenStreetMap e OpenMapTiles
const ATTRIBUTION = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';
const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const TEXT_COLOR = '#1d2330';
const MUTED_COLOR = '#687185';

/**
 * Compone l'immagine. I marker sono elementi HTML fuori dal canvas WebGL:
 * vengono ridisegnati qui nelle stesse posizioni.
 * @param {{title: string, days: {label: string, color: string, stops: {lat: number, lng: number}[]}[]}} content
 * @returns {Promise<Blob>}
 */
export async function renderTripImage({ title, days }) {
  const map = getMap();
  if (!map.loaded()) await map.once('idle');
  const mapCanvas = map.getCanvas();
  const scale = mapCanvas.width / mapCanvas.clientWidth;
  const px = (value) => value * scale;
  const width = mapCanvas.width;
  const padding = px(16);

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  // legenda su piu' righe se non ci sta
  context.font = `${px(14)}px ${FONT_FAMILY}`;
  const dotSize = px(10);
  const legendItems = [];
  let x = padding;
  let row = 0;
  for (const day of days) {
    const itemWidth = dotSize + px(6) + context.measureText(day.label).width;
    if (x > padding && x + itemWidth > width - padding) {
      row += 1;
      x = padding;
    }
    legendItems.push({ day, x, row });
    x += itemWidth + px(18);
  }
  const legendRows = days.length ? row + 1 : 0;
  const lineHeight = px(22);
  const legendTop = padding + px(34);
  const headerHeight = legendTop + legendRows * lineHeight + px(6);
  const footerHeight = px(24);

  canvas.width = width;
  canvas.height = headerHeight + mapCanvas.height + footerHeight;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.textBaseline = 'middle';

  context.fillStyle = TEXT_COLOR;
  context.font = `600 ${px(22)}px ${FONT_FAMILY}`;
  context.fillText(title, padding, padding + px(12), width - 2 * padding);

  context.font = `${px(14)}px ${FONT_FAMILY}`;
  for (const { day, x: itemX, row: itemRow } of legendItems) {
    const centerY = legendTop + itemRow * lineHeight + lineHeight / 2;
    context.fillStyle = day.color;
    context.beginPath();
    context.arc(itemX + dotSize / 2, centerY, dotSize / 2, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = TEXT_COLOR;
    context.fillText(day.label, itemX + dotSize + px(6), centerY);
  }

  context.drawImage(mapCanvas, 0, headerHeight);

  context.save();
  context.beginPath();
  context.rect(0, headerHeight, width, mapCanvas.height);
  context.clip();
  context.textAlign = 'center';
  context.font = `600 ${px(13)}px ${FONT_FAMILY}`;
  context.lineWidth = px(2);
  context.strokeStyle = '#ffffff';
  for (const day of days) {
    day.stops.forEach((stop, index) => {
      const point = map.project([stop.lng, stop.lat]);
      const centerX = point.x * scale;
      const centerY = headerHeight + point.y * scale;
      context.fillStyle = day.color;
      context.beginPath();
      context.arc(centerX, centerY, px(12), 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.fillStyle = '#ffffff';
      context.fillText(String(index + 1), centerX, centerY + px(1));
    });
  }
  context.restore();

  context.fillStyle = MUTED_COLOR;
  context.font = `${px(11)}px ${FONT_FAMILY}`;
  context.textAlign = 'right';
  context.fillText(ATTRIBUTION, width - padding, headerHeight + mapCanvas.height + footerHeight / 2);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob fallito'))), 'image/png');
  });
}
