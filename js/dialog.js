// Finestra modale unica, riempita di volta in volta
import { el, byId } from './dom.js';
import { t } from './i18n.js';

const dialog = byId('dialog');
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

export function openDialog(title, ...content) {
  dialog.replaceChildren(el('h2', { textContent: title }), ...content);
  if (!dialog.open) dialog.showModal();
}

export function closeDialog() {
  dialog.close();
}

export const hint = (text) => el('p', { className: 'hint', textContent: text });
/** Pulsanti in basso a destra: l'azione principale va per ultima. */
export const actions = (...buttons) => el('div', { className: 'azioni' }, ...buttons);
export const closeButton = () => el('button', { type: 'button', className: 'btn', textContent: t('dialog.close'), onclick: closeDialog });

/**
 * Scrive un messaggio di stato. Un errore prende il riquadro di pericolo, con la parte
 * fino ai due punti in grassetto: lo dicono le parole, non il solo colore.
 */
export function setStatus(node, message, isError = false) {
  node.classList.toggle('avviso', isError);
  node.classList.toggle('errore', isError);
  const [lead, ...rest] = isError ? message.split(': ') : [];
  if (rest.length) node.replaceChildren(el('b', { textContent: `${lead}:` }), ` ${rest.join(': ')}`);
  else node.textContent = message;
}

/** Copia negli appunti e scrive l'esito in status. */
export async function copyText(text, status, successMessage = t('dialog.copied')) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(status, successMessage);
  } catch {
    setStatus(status, t('dialog.copyError'), true);
  }
}
