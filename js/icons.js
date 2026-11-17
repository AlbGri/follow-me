// Icone e bandiere in SVG in linea: emoji e caratteri-simbolo cambiano da un sistema all'altro
const ICONS = {
  down: '<path d="M4 6l4 4 4-4"/>',
  right: '<path d="M6 4l4 4-4 4"/>',
  pencil: '<path d="M3 13l1-3 7-7 2 2-7 7z"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  dots: '<circle cx="3" cy="8" r=".75"/><circle cx="8" cy="8" r=".75"/><circle cx="13" cy="8" r=".75"/>',
};

const FLAGS = {
  en:
    '<svg viewBox="0 0 60 40" aria-hidden="true"><rect width="60" height="40" fill="#012169"/>' +
    '<path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#c8102e" stroke-width="3"/>' +
    '<path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/></svg>',
  it:
    '<svg viewBox="0 0 3 2" aria-hidden="true"><rect width="1" height="2" fill="#009246"/>' +
    '<rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
};

function svg(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup;
  return template.content.firstChild;
}

/** @param {'down'|'right'|'pencil'|'close'|'dots'} name */
export const icon = (name) => svg(`<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`);

/** @param {'it'|'en'} code */
export const flag = (code) => svg(FLAGS[code]);
