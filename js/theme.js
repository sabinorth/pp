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
  sparkles(t === 'emo');
}

// Блинки-плашки — чистый декор (в обычной теме скрыты стилями).
const BLINKIES = ['✨ Praha ♥ Paris ✨', '🖤 tired but cute', '☕ coffee > sleep', '🦇 xoxo 2026', '💜 rawr means i ♥ u', '🌙 slow travel club'];

// seed — чтобы на разных страницах были разные плашки, но стабильно между перерисовками.
export function blinkiesHTML(seed = '') {
  const start = [...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % BLINKIES.length;
  const picked = [0, 1, 2].map((i) => BLINKIES[(start + i * 2) % BLINKIES.length]);
  return `<div class="blinkies" aria-hidden="true">${picked.map((b) => `<span class="blinkie">${b}</span>`).join('')}</div>`;
}

// Курсор-блёстки: только мышь, только эмо, не при prefers-reduced-motion.
// JS лишь создаёт <span>, анимация — CSS (.spark).
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const SPARKS = ['✦', '✧', '★', '♥'];
let lastSpark = 0;
let sparkOn = false;

function onMove(e) {
  if (calm.matches || e.timeStamp - lastSpark < 45) return;
  lastSpark = e.timeStamp;
  const s = document.createElement('span');
  s.className = 'spark';
  s.setAttribute('aria-hidden', 'true');
  s.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)];
  s.style.left = `${e.clientX + Math.random() * 16 - 8}px`;
  s.style.top = `${e.clientY + Math.random() * 16 - 8}px`;
  s.addEventListener('animationend', () => s.remove());
  document.body.append(s);
}

function sparkles(on) {
  on = on && fine.matches;
  if (on === sparkOn) return;
  sparkOn = on;
  if (on) window.addEventListener('pointermove', onMove, { passive: true });
  else window.removeEventListener('pointermove', onMove);
}
