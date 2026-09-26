// Личные настройки и «Моё» в localStorage. Если хранилище недоступно
// (приватный режим, запрет сайта), всё работает в памяти до перезагрузки.
const KEY = 'trip2026:v1';
let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    state = {};
  }
  return state;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function get(key, fallback) {
  const v = load()[key];
  return v === undefined ? fallback : v;
}

export function set(key, value) {
  load()[key] = value;
  return save();
}

// ---------- «Моё»: пункты, перенесённые из «Советов» в день ----------
// { "2026-10-06": [{ city: "paris", place_id: "orsay" }] }

export function getMine(date) {
  return get('mine', {})[date] || [];
}

export function addMine(date, item) {
  const all = { ...get('mine', {}) };
  const list = all[date] || [];
  if (list.some((x) => x.city === item.city && x.place_id === item.place_id)) return false;
  all[date] = [...list, { city: item.city, place_id: item.place_id }];
  set('mine', all);
  return true;
}

export function removeMine(date, city, placeId) {
  const all = { ...get('mine', {}) };
  all[date] = (all[date] || []).filter((x) => !(x.city === city && x.place_id === placeId));
  if (!all[date].length) delete all[date];
  set('mine', all);
}

export function clearMine() {
  set('mine', {});
}
