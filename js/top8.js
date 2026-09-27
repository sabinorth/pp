// «Top 8» как на MySpace: каждый игрок отмечает до 8 любимых точек.
// Хранение: store `top8` → { "0": ["paris/louvre", …], "1": […] } (ключ — номер игрока).
import * as store from './store.js';
import { esc, TYPES, whose } from './ui.js';
import { getPlayers, playerName } from './players.js';

export const TOP_MAX = 8;

function all() {
  const t = store.get('top8', {});
  return t && typeof t === 'object' ? t : {};
}

export function list(i) {
  const l = all()[i];
  return Array.isArray(l) ? l.slice(0, TOP_MAX) : [];
}

// → 'added' | 'removed' | 'full'
export function toggle(i, key) {
  const t = { ...all() };
  const l = list(i);
  if (l.includes(key)) {
    t[i] = l.filter((k) => k !== key);
    store.set('top8', t);
    return 'removed';
  }
  if (l.length >= TOP_MAX) return 'full';
  t[i] = [...l, key];
  store.set('top8', t);
  return 'added';
}

function btnHTML(players, i, key) {
  const on = list(i).includes(key);
  return `<button type="button" class="chip top8-btn" data-top8="${i}" aria-pressed="${on}">${on ? '💖' : '⭐'} ${esc(playerName(players, i))}</button>`;
}

// Кнопки в шторке места.
export function top8HTML(p) {
  const players = getPlayers();
  const key = `${p.city}/${p.id}`;
  return `<div class="top8-pick" data-key="${esc(key)}">
    <p class="top8-pick-title">Top 8 — чьё любимое место?</p>
    <div class="top8-btns">${players.map((_, i) => btnHTML(players, i, key)).join('')}</div>
    <p class="add-result" role="status"></p>
  </div>`;
}

document.querySelector('#sheet .sheet-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-top8]');
  const box = btn?.closest('.top8-pick');
  if (!box) return;
  const players = getPlayers();
  const i = Number(btn.dataset.top8);
  const res = toggle(i, box.dataset.key);
  const who = playerName(players, i);
  const msg = {
    added: `💖 В Top 8 у ${who}.`,
    removed: `Убрано из Top 8 у ${who}.`,
    full: `У ${who} уже ${TOP_MAX} мест — сначала убери кого-нибудь.`,
  }[res];
  if (res !== 'full') btn.outerHTML = btnHTML(players, i, box.dataset.key);
  box.querySelector('.add-result').textContent = msg;
});

// Сетки 4×2 на странице «План». places: Map «city/id» → место.
export function gridsHTML(places) {
  const players = getPlayers();
  return players.map((_, i) => {
    const name = playerName(players, i);
    const keys = list(i).filter((k) => places.has(k));
    const slots = Array.from({ length: TOP_MAX }, (_, n) => {
      const p = places.get(keys[n]);
      if (!p) return '<span class="top8-slot empty" aria-hidden="true">?</span>';
      return `<a class="top8-slot" href="#/map?city=${p.city}&place=${encodeURIComponent(p.id)}">
        <span class="top8-ic" aria-hidden="true">${(TYPES[p.type] || TYPES.sight).icon}</span>
        <span class="top8-name">${esc(p.name)}</span></a>`;
    }).join('');
    return `<section class="card top8">
      <h2 class="mod-head">${whose('⭐ Top 8', name)}<span class="not-emo"> · ${esc(name)}</span></h2>
      <div class="top8-grid">${slots}</div>
      ${keys.length ? '' : '<p class="muted">Пока пусто. Отметить: ⭐ в шторке места на карте.</p>'}
    </section>`;
  }).join('');
}
