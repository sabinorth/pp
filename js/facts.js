// «К слову»-факты про Оливию Родриго и My Little Pony (data/fun-facts.json).
// Разметка: slot(ctx) кладёт пустой <aside>, fill(root) заполняет первый слот и убирает остальные —
// на экране всегда не больше одного факта. Просмотренные — в store (facts_seen), выключатель — facts_off.
import { loadJSON } from './data.js';
import * as store from './store.js';
import { esc } from './ui.js';

const TOPIC_ICON = { olivia: '🎤', mlp: '🦄' };
const MATCH_LEADS = ['К слову', 'Между прочим', 'Кстати'];
const CITY_TAGS = { prague: ['прага', 'чехия'], paris: ['париж', 'франция'] };
const CITY_TAG_SET = new Set(Object.values(CITY_TAGS).flat());
const TYPE_TAGS = { cafe: ['кофе'], rest: ['усталость'], park: ['фото'] };

// Теги точек → канонические теги фактов.
const TAG_MAP = {
  'на дождь': 'дождь',
  'вечер': 'ночь', 'ночь': 'ночь', 'допоздна': 'ночь', 'поздно': 'ночь', 'поздний ужин': 'ночь', 'закат': 'ночь', 'вечером особенно': 'ночь',
  'чайный салон': 'кофе', 'завтрак': 'кофе', 'завтрак рано': 'кофе', 'горячий шоколад': 'кофе',
  'еда': 'еда', 'чешская кухня': 'еда', 'брассери': 'еда', 'сыр': 'еда', 'вино': 'еда', 'пиво': 'еда', 'рынок': 'еда',
  'сладкое': 'сладкое', 'десерты': 'сладкое', 'выпечка': 'сладкое',
  'кино': 'кино',
  'театр': 'театр', 'балет': 'театр', 'шоу': 'театр', 'кабаре': 'театр',
  'джаз': 'музыка', 'концерты': 'музыка',
  'мода': 'мода', 'нарядиться': 'мода',
  'сувенир': 'магазины', 'антиквариат': 'магазины', 'старые вещи': 'магазины', 'старые открытки': 'магазины',
  'фото': 'фото', 'вид': 'фото', 'красиво': 'фото',
  'Версаль': 'замок', 'вид на Град': 'замок', 'готика': 'замок', 'средневековье': 'замок', 'рядом с Градом': 'замок',
  'книги': 'книги',
  'история': 'история', 'исторический': 'история', 'старинное': 'история',
  'паровозик': 'поезд', 'фуникулёр вместо лестниц': 'поезд', 'вокзал': 'поезд',
  'отдых': 'усталость', 'сидя': 'усталость', 'можно посидеть': 'усталость', 'можно посидеть долго': 'усталость',
  'подарок друг другу': 'дружба', 'игра': 'дружба',
};

// Цвета в названии и описании точки.
const COLORS = [
  [/жёлт|желт/i, 'жёлтый'], [/розов/i, 'розовый'], [/фиолет|сиренев|лилов/i, 'фиолетовый'],
  [/голуб|лазур/i, 'голубой'], [/радуг|радуж/i, 'радуга'], [/золот|позолот/i, 'золотой'],
  [/зелён|зелен/i, 'зелёный'], [/красн|алый|алая/i, 'красный'],
];

let facts = null;
let loading = null;

export function init() {
  loading ??= loadJSON('fun-facts.json').then((list) => { facts = list; }).catch(() => { facts = []; });
  return loading;
}

export const isOn = () => !store.get('facts_off', false);
export const setOn = (on) => store.set('facts_off', !on);

// Контекст: { place, city, tags } → множество канонических тегов.
export function contextTags(ctx = {}) {
  const out = new Set(ctx.tags || []);
  const p = ctx.place;
  for (const t of CITY_TAGS[ctx.city || p?.city] || []) out.add(t);
  if (p) {
    for (const t of TYPE_TAGS[p.type] || []) out.add(t);
    for (const t of p.tags || []) {
      if (TAG_MAP[t]) out.add(TAG_MAP[t]);
      else if (t.startsWith('вид на')) out.add('фото');
    }
    if (/замок|дворец|донжон|Град/i.test(p.name || '')) out.add('замок');
    const text = [p.name, p.summary, p.description].filter(Boolean).join(' ');
    for (const [re, tag] of COLORS) if (re.test(text)) out.add(tag);
  }
  return out;
}

function pick(tags, exceptId) {
  let seen = new Set(store.get('facts_seen', []));
  let pool = facts.filter((f) => !seen.has(f.id) && f.id !== exceptId);
  if (!pool.length) {
    seen = new Set();
    store.set('facts_seen', []);
    pool = facts.filter((f) => f.id !== exceptId);
  }
  // Город совпадает почти всегда, поэтому весит меньше, чем цвет, кино или усталость.
  let best = 0, top = [];
  for (const f of pool) {
    const n = f.tags.reduce((sum, t) => sum + (tags.has(t) ? (CITY_TAG_SET.has(t) ? 1 : 2) : 0), 0);
    if (n > best) { best = n; top = [f]; } else if (n === best) top.push(f);
  }
  const fact = top[Math.floor(Math.random() * top.length)];
  if (fact) store.set('facts_seen', [...seen, fact.id]);
  return { fact, matched: best > 0 };
}

export function slot(ctx = {}) {
  if (!facts?.length || !isOn()) return '';
  return `<aside class="fun-fact" data-fact-ctx="${esc(JSON.stringify(ctx))}" aria-live="polite"></aside>`;
}

// Точка из данных слишком большая для атрибута — берём только то, что нужно для тегов.
export function placeCtx(p, extra = []) {
  if (!p) return { tags: extra };
  return { place: { city: p.city, type: p.type, name: p.name, summary: p.summary, description: p.description, tags: p.tags }, tags: extra };
}

// Последний показанный факт: при перерисовке того же экрана (↑↓ в плане и т. п.) он не меняется.
let last = null;

function render(el, exceptId) {
  const key = `${location.hash}|${el.dataset.factCtx}`;
  let shown = !exceptId && last?.key === key ? last : null;
  if (!shown) {
    let ctx = {};
    try { ctx = JSON.parse(el.dataset.factCtx || '{}'); } catch { /* пустой контекст */ }
    const { fact, matched } = pick(contextTags(ctx), exceptId);
    if (!fact) { el.remove(); return; }
    const lead = matched ? `${MATCH_LEADS[Math.floor(Math.random() * MATCH_LEADS.length)]}, ` : 'А вот ещё: ';
    shown = last = { key, fact, lead };
  }
  const { fact, lead } = shown;
  el.dataset.factId = fact.id;
  el.innerHTML = `<p><span class="fun-fact-icon" aria-hidden="true">${TOPIC_ICON[fact.topic] || '✨'}</span> ${esc(lead)}${esc(fact.text)}</p>
    <button type="button" class="fun-fact-more" data-fact-more>Ещё факт</button>`;
}

export function fill(root) {
  if (!root) return;
  const slots = [...root.querySelectorAll('.fun-fact')];
  for (const el of document.querySelectorAll('.fun-fact')) if (!root.contains(el)) el.remove();
  if (!slots.length) return;
  if (!facts?.length || !isOn()) { slots.forEach((el) => el.remove()); return; }
  slots.slice(1).forEach((el) => el.remove());
  render(slots[0]);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-fact-more]');
  const el = b?.closest('.fun-fact');
  if (el) render(el, el.dataset.factId);
});
