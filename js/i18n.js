const STORAGE_KEY = 'followme.language';

let language = 'it';
let strings = {};

export async function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const browserDefault = navigator.language.startsWith('it') ? 'it' : 'en';
  await setLanguage(saved || browserDefault);
}

/** Carica la lingua e aggiorna i testi statici marcati con data-i18n*. */
export async function setLanguage(code) {
  const response = await fetch(new URL(`../i18n/${code}.json`, import.meta.url));
  strings = await response.json();
  language = code;
  localStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;

  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
}

export function getLanguage() {
  return language;
}

/** Testo tradotto; i segnaposto {nome} vengono sostituiti con vars.nome. */
export function t(key, vars = {}) {
  return (strings[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? '');
}
