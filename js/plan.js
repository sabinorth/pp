// Ручной план дня поверх data/days.json. Хранится в localStorage через store.js.
// dayplans: { "2026-10-06": {
//   added:  [{ id: "k3f9", city: "paris", place_id: "orsay", time: "18:30", note: "" }],
//   hidden: ["a:orsay"],                       // скрытые базовые пункты «план:place_id»
//   order:  { a: ["a:orsay", "u:k3f9"], b: [] }, // ручной порядок для плана А и Б
//   meta:   { "a:orsay": { time: "10:00", note: "" } } // время и заметка базовых пунктов
// } }
import * as store from './store.js';

const KEY = 'dayplans';
const PLANS = ['a', 'b'];

function all() {
  migrateMine();
  return store.get(KEY, {});
}

function getDay(date) {
  const d = all()[date] || {};
  return {
    added: d.added || [],
    hidden: d.hidden || [],
    order: d.order || {},
    meta: d.meta || {},
  };
}

function saveDay(date, d) {
  const next = { ...all() };
  const empty = !d.added.length && !d.hidden.length && !Object.keys(d.meta).length
    && PLANS.every((p) => !d.order[p]?.length);
  if (empty) delete next[date];
  else next[date] = d;
  store.set(KEY, next);
}

function newId() {
  return Math.random().toString(36).slice(2, 7);
}

// Старое «Моё» ({ date: [{ city, place_id }] }) переносим в добавленные пункты.
function migrateMine() {
  const mine = store.get('mine');
  if (!mine) return;
  const plans = { ...store.get(KEY, {}) };
  for (const [date, list] of Object.entries(mine)) {
    const d = plans[date] || { added: [], hidden: [], order: {}, meta: {} };
    for (const m of list || []) {
      if (!d.added.some((a) => a.city === m.city && a.place_id === m.place_id)) {
        d.added.push({ id: newId(), city: m.city, place_id: m.place_id, time: '', note: '' });
      }
    }
    plans[date] = d;
  }
  store.set(KEY, plans);
  store.set('mine', undefined);
}

// ---------- выбор плана А/Б ----------

export function activePlan(date) {
  return store.get('plans', {})[date] === 'b' ? 'b' : 'a';
}

export function setActivePlan(date, plan) {
  store.set('plans', { ...store.get('plans', {}), [date]: plan });
}

// ---------- пункты дня ----------

function baseEntries(day, plan) {
  const seen = {};
  return (day[plan === 'b' ? 'plan_b' : 'plan_a'] || []).map((item, i) => {
    let key = item.place_id ? `${plan}:${item.place_id}` : `${plan}:#${i}`;
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] > 1) key += `~${seen[key]}`;
    return { key, base: true, item };
  });
}

// Все пункты дня в ручном порядке: базовые (с отметкой hidden) и добавленные.
// Каждый: { key, base, hidden, item: { city, place_id, pause, why, … }, time, note }
export function entries(day, plan) {
  const d = getDay(day.date);
  const list = [
    ...baseEntries(day, plan).map((e) => ({
      ...e,
      hidden: d.hidden.includes(e.key),
      time: d.meta[e.key]?.time || '',
      note: d.meta[e.key]?.note || '',
    })),
    ...d.added.map((a) => ({
      key: `u:${a.id}`,
      base: false,
      hidden: false,
      item: { city: a.city, place_id: a.place_id },
      time: a.time || '',
      note: a.note || '',
    })),
  ];
  const order = d.order[plan] || [];
  const pos = (k) => {
    const i = order.indexOf(k);
    return i === -1 ? Infinity : i;
  };
  // Ключи из order — на своих местах, новые — в исходном порядке в конце.
  return list
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (pos(x.e.key) - pos(y.e.key)) || (x.i - y.i))
    .map((x) => x.e);
}

export function visibleEntries(day, plan) {
  return entries(day, plan).filter((e) => !e.hidden);
}

// Добавленные пункты общие для планов А и Б.
export function hasAdded(date, city, placeId) {
  return getDay(date).added.some((a) => a.city === city && a.place_id === placeId);
}

export function add(date, { city, place_id }) {
  const d = getDay(date);
  if (d.added.some((a) => a.city === city && a.place_id === place_id)) return false;
  d.added = [...d.added, { id: newId(), city, place_id, time: '', note: '' }];
  saveDay(date, d);
  return true;
}

// Добавленный пункт удаляется, базовый — скрывается.
export function remove(date, key) {
  const d = getDay(date);
  if (key.startsWith('u:')) {
    const id = key.slice(2);
    d.added = d.added.filter((a) => a.id !== id);
    for (const p of PLANS) if (d.order[p]) d.order = { ...d.order, [p]: d.order[p].filter((k) => k !== key) };
  } else if (!d.hidden.includes(key)) {
    d.hidden = [...d.hidden, key];
  }
  saveDay(date, d);
}

export function restore(date, key) {
  const d = getDay(date);
  d.hidden = d.hidden.filter((k) => k !== key);
  saveDay(date, d);
}

export function restoreAll(date) {
  const d = getDay(date);
  d.hidden = [];
  saveDay(date, d);
}

// Сдвиг на одну позицию среди видимых пунктов (dir = -1 вверх, +1 вниз).
export function move(day, plan, key, dir) {
  const list = entries(day, plan);
  const visible = list.filter((e) => !e.hidden);
  const vi = visible.findIndex((e) => e.key === key);
  const other = visible[vi + dir];
  if (vi === -1 || !other) return;
  const keys = list.map((e) => e.key);
  const a = keys.indexOf(key), b = keys.indexOf(other.key);
  [keys[a], keys[b]] = [keys[b], keys[a]];
  const d = getDay(day.date);
  d.order = { ...d.order, [plan]: keys };
  saveDay(day.date, d);
}

export function setMeta(date, key, { time, note }) {
  const d = getDay(date);
  const clean = { time: time || '', note: (note || '').trim() };
  if (key.startsWith('u:')) {
    const id = key.slice(2);
    d.added = d.added.map((a) => (a.id === id ? { ...a, ...clean } : a));
  } else {
    const meta = { ...d.meta };
    if (clean.time || clean.note) meta[key] = clean;
    else delete meta[key];
    d.meta = meta;
  }
  saveDay(date, d);
}

export function clearAll() {
  store.set(KEY, {});
}

// ---------- экспорт, импорт, ссылка ----------
// Нас двое с разными телефонами: план переносится файлом или ссылкой #/plan?import=…

const APP = 'trip2026-plan';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function exportData() {
  return { app: APP, v: 1, dayplans: all(), plans: store.get('plans', {}) };
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const time = (v) => (TIME_RE.test(v) ? v : '');
const keyList = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string').map((k) => k.slice(0, 100)) : []);

function cleanDay(d) {
  if (!d || typeof d !== 'object') return null;
  const added = (Array.isArray(d.added) ? d.added : [])
    .filter((a) => a && typeof a.city === 'string' && typeof a.place_id === 'string')
    .map((a) => ({ id: str(a.id, 12) || newId(), city: str(a.city, 20), place_id: str(a.place_id, 80), time: time(a.time), note: str(a.note, 500) }));
  const order = {};
  for (const p of PLANS) if (Array.isArray(d.order?.[p])) order[p] = keyList(d.order[p]);
  const meta = {};
  for (const [k, m] of Object.entries(d.meta && typeof d.meta === 'object' ? d.meta : {})) {
    const t = time(m?.time), n = str(m?.note, 500);
    if (t || n) meta[k.slice(0, 100)] = { time: t, note: n };
  }
  return { added, hidden: keyList(d.hidden), order, meta };
}

// Проверяет и нормализует данные; бросает ошибку, если это не план.
export function parseImport(obj) {
  if (!obj || obj.app !== APP || !obj.dayplans || typeof obj.dayplans !== 'object') {
    throw new Error('Это не файл плана поездки.');
  }
  const dayplans = {};
  for (const [date, d] of Object.entries(obj.dayplans)) {
    const clean = DATE_RE.test(date) && cleanDay(d);
    if (clean) dayplans[date] = clean;
  }
  const plans = {};
  for (const [date, p] of Object.entries(obj.plans && typeof obj.plans === 'object' ? obj.plans : {})) {
    if (DATE_RE.test(date) && (p === 'a' || p === 'b')) plans[date] = p;
  }
  return { dayplans, plans };
}

export function importSummary({ dayplans }) {
  const ds = Object.values(dayplans);
  return {
    days: ds.length,
    added: ds.reduce((n, d) => n + d.added.length, 0),
    hidden: ds.reduce((n, d) => n + d.hidden.length, 0),
  };
}

// Полностью заменяет текущий ручной план.
export function applyImport({ dayplans, plans }) {
  store.set('mine', undefined);
  store.set(KEY, dayplans);
  store.set('plans', plans);
}

export function encode(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decode(code) {
  const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}
