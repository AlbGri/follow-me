// Pulsante "Salva app" (come in fugit): prompt nativo dove esiste (Chrome, Edge, Android),
// altrimenti istruzioni per la piattaforma. Nascosto se l'app e' gia' installata.
import { el } from './dom.js';
import { t } from './i18n.js';
import { openDialog, hint, actions, closeButton } from './dialog.js';

let deferredPrompt = null;

export function isInstalled() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function setupInstallButton(button) {
  if (isInstalled()) return;
  button.hidden = false;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    deferredPrompt = null;
  });
  button.addEventListener('click', async () => {
    if (!deferredPrompt) {
      openInstructions();
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
  });
}

function platform() {
  const userAgent = navigator.userAgent;
  // iPadOS si presenta come Mac: lo distingue il touch
  if (/iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

function openInstructions() {
  const key = platform();
  openDialog(
    t('install.title'),
    el('p', { textContent: t('install.intro') }),
    el('ol', { className: 'install-steps' }, ...t(`install.steps.${key}`).split('\n').map((step) => el('li', { textContent: step }))),
    ...(key === 'ios' ? [hint(t('install.iosNote'))] : []),
    actions(closeButton()),
  );
}
