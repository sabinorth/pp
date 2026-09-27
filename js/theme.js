// Визуальная тема: «emo» (эмо-MySpace, по умолчанию) и «plain» (обычная).
// Атрибут data-theme на <html> ставит ещё инлайн-скрипт в index.html, здесь — переключение.
import * as store from './store.js';

export const THEMES = {
  emo:   { label: '🖤 Эмо', color: '#0d0612' },
  plain: { label: 'Обычная', color: null },
};

export function getTheme() {
  const t = store.get('theme', 'emo');
  return t in THEMES ? t : 'emo';
}

export function setTheme(t) {
  store.set('theme', t);
  apply(t);
}

// theme-color в адресной строке: у эмо свой, у обычной — исходные значения из index.html.
function applyThemeColor(t) {
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.dataset.orig ??= meta.content;
    meta.content = THEMES[t].color || meta.dataset.orig;
  }
}

export function apply(t = getTheme()) {
  document.documentElement.dataset.theme = t;
  applyThemeColor(t);
}
