// Tema: segue il sistema finche' non si sceglie, poi la scelta resta salvata.
// index.html la applica gia' prima del primo disegno, per non far lampeggiare il chiaro.
const STORAGE_KEY = 'follow-me/tema';
// colore della barra del telefono: quello della superficie, nei due temi
const BAR_COLORS = { chiaro: '#f4f6fa', scuro: '#232025' }; // stile:consentito
const systemDark = matchMedia('(prefers-color-scheme: dark)');

export function isDark() {
  return (localStorage.getItem(STORAGE_KEY) ?? (systemDark.matches ? 'scuro' : 'chiaro')) === 'scuro';
}

/** Con il tema scelto a mano la barra del telefono segue il sito, non il sistema. */
function applyChosenTheme() {
  const theme = localStorage.getItem(STORAGE_KEY);
  if (!theme) return;
  document.documentElement.dataset.tema = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.removeAttribute('media');
    meta.content = BAR_COLORS[theme];
  });
}

export function toggleTheme() {
  localStorage.setItem(STORAGE_KEY, isDark() ? 'chiaro' : 'scuro');
  applyChosenTheme();
}

/** Chiama callback quando cambia il tema di sistema e non c'e' una scelta salvata. */
export function onSystemThemeChange(callback) {
  systemDark.addEventListener('change', () => {
    if (!localStorage.getItem(STORAGE_KEY)) callback();
  });
}

applyChosenTheme();
