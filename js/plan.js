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
