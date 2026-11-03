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
export const actions = (...buttons) => el('div', { className: 'dialog-actions' }, ...buttons);
export const closeButton = () => el('button', { type: 'button', textContent: t('dialog.close'), onclick: closeDialog });

/** Copia negli appunti e scrive l'esito in status. */
export async function copyText(text, status, successMessage = t('dialog.copied')) {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = successMessage;
  } catch {
    status.textContent = t('dialog.copyError');
  }
}
