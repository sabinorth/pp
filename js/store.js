// Личные настройки и ручной план в localStorage. Если хранилище недоступно
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
