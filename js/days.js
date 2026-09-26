// План по дням: лента (#/plan) и карточка дня (#/day/2026-10-08).
import { CITIES, getDays, getPlaces } from './data.js';
import { esc, fmtDate, fmtWeekday, todayISO, EFFORT_LEVELS, BEST_TIME } from './ui.js';
import * as store from './store.js';
import * as energy from './energy.js';

function cityLine(day) {
  const to = CITIES[day.city];
  if (day.city_from && CITIES[day.city_from]) {
    const from = CITIES[day.city_from];
    return `${from.flag} ${from.name} → ${to.flag} ${to.name}`;
  }
  return `${to.flag} ${to.name}`;
}

function badgesHTML(day) {
  if (!day.badges?.length) return '';
  return `<div class="day-badges">${day.badges.map((b) => `<span class="badge warn">${esc(b)}</span>`).join('')}</div>`;
}

export async function renderList() {
  const days = await getDays();
  const today = todayISO();
  const cards = days.map((d) => {
    const titles = (d.plan_a || []).filter((it) => !it.pause).length;
    return `<a class="card day-card${d.date === today ? ' today' : ''}" href="#/day/${d.date}" data-date="${d.date}">
      <div class="day-head">
        <span class="day-date">${fmtWeekday(d.date)}, ${fmtDate(d.date)}</span>
        <span class="day-city">${cityLine(d)}</span>
        ${d.date === today ? '<span class="badge">сегодня</span>' : ''}
      </div>
      ${badgesHTML(d)}
      <div class="day-sub">${titles ? `Мест в плане: ${titles}` : 'Пока пусто'}${d.events?.length ? ` · событий: ${d.events.length}` : ''}</div>
    </a>`;
  });
  return `<h1>План</h1><div class="days">${cards.join('')}</div>`;
}

export function afterList(el) {
  el.querySelector('.day-card.today')?.scrollIntoView({ block: 'center' });
}

export async function placeIndex(cities) {
  const lists = await Promise.all(cities.map((c) => getPlaces(c)));
  const index = new Map();
  for (const p of lists.flat()) index.set(`${p.city}/${p.id}`, p);
  return index;
}

export function dayCities(day) {
  const items = [...(day.plan_a || []), ...(day.plan_b || [])];
  return [...new Set([day.city, day.city_from, ...items.map((it) => it.city)].filter(Boolean))];
}

function itemHTML(item, day, places, removable = false) {
  const city = item.city || day.city;
  const p = item.place_id ? places.get(`${city}/${item.place_id}`) : null;
  const lvl = !item.pause && p?.effort ? EFFORT_LEVELS[p.effort.level] : null;
  const icon = item.pause ? '☕' : (lvl ? `<span title="Нагрузка: ${lvl.label}">${lvl.icon}</span>` : '');
  const title = esc(item.title || p?.name || '');
  const main = item.place_id
    ? `<a class="item-place" href="#/map?city=${city}&place=${encodeURIComponent(item.place_id)}">${icon}${title} 🗺️</a>`
    : `<span class="item-place">${icon}${title}</span>`;
  const bt = BEST_TIME[item.best_time];
  const when = bt ? `<p class="item-when">${bt.icon} ${bt.label}${item.best_time_why ? ` — ${esc(item.best_time_why)}` : ''}</p>` : '';
  const remove = removable
    ? `<button type="button" class="icon-btn" data-remove="${city}/${esc(item.place_id)}" aria-label="Убрать из моего дня">✕</button>` : '';
  return `<li class="card item${item.pause ? ' pause' : ''}">
    <div class="item-main">${main}${when}${item.why ? `<p class="muted">${esc(item.why)}</p>` : ''}</div>${remove}
  </li>`;
}

export function planHTML(items, day, places) {
  if (!items?.length) return '<div class="card"><p class="muted">Пока пусто.</p></div>';
  return `<ol class="items">${items.map((it) => itemHTML(it, day, places)).join('')}</ol>`;
}

function mineHTML(mine, day, places) {
  const list = mine.length
    ? `<ol class="items">${mine.map((m) => itemHTML(m, day, places, true)).join('')}</ol>`
    : '<div class="card"><p class="muted">Пусто. Пункты добавляются из «Советов» кнопкой «В мой день».</p></div>';
  return `<section id="mine"><h2 class="section">⭐ Моё</h2>${list}</section>`;
}

function activePlan(date) {
  return store.get('plans', {})[date] === 'b' ? 'b' : 'a';
}

function setPlan(date, plan) {
  store.set('plans', { ...store.get('plans', {}), [date]: plan });
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function budgetHTML(day, plan, mine, places) {
  const items = [...(plan === 'b' ? day.plan_b : day.plan_a) || [], ...mine];
  const value = energy.score(items, day.city, places);
  const limit = energy.getThreshold();
  let hint = '';
  if (value > limit) {
    hint = plan === 'a'
      ? `<div class="card soft-warn"><p>Сегодня насыщенно. Может, взять план Б? Он спокойнее.</p>
          <button type="button" class="btn" data-plan="b">Переключить на план Б</button></div>`
      : `<div class="card soft-warn"><p>Даже с планом Б получается много. Можно убрать что-то из «Моё» — отдых важнее.</p></div>`;
  }
  return `${energy.meterHTML(value, limit)}
    <p class="muted energy-note">Порог ${limit} меняется в <a href="#/recs?tab=practical&focus=settings">настройках</a>.</p>${hint}`;
}

export function afterDay(el, r) {
  el.querySelector('.day-page').addEventListener('click', (e) => {
    const b = e.target.closest('[data-plan]');
    if (b && b.getAttribute('aria-pressed') !== 'true') setPlan(r.param, b.dataset.plan);
  });
  el.querySelector('#mine')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const [city, placeId] = b.dataset.remove.split('/');
    store.removeMine(r.param, city, placeId);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

function fmtRange(from, to) {
  if (!to || from === to) return fmtDate(from);
  return `${fmtDate(from)} – ${fmtDate(to)}`;
}

function eventsHTML(events) {
  if (!events?.length) return '';
  const cards = events.map((e) => `<li class="card event">
      <strong>${esc(e.title)}</strong>${e.title_local ? ` <span class="muted">(${esc(e.title_local)})</span>` : ''}
      <p>📅 ${fmtRange(e.date_from, e.date_to)}${e.time ? `, ${esc(e.time)}` : ''} · 📍 ${esc(e.where)}</p>
      ${e.note ? `<p class="muted">${esc(e.note)}</p>` : ''}
      <p class="event-links">${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">Подробнее</a>` : ''}
        ${e.source && e.source !== e.url ? ` · <a href="${esc(e.source)}" target="_blank" rel="noopener">источник</a>` : ''}</p>
    </li>`);
  return `<h2 class="section">🎭 События</h2><ul class="items">${cards.join('')}</ul>`;
}

function warningsHTML(warnings) {
  if (!warnings?.length) return '';
  return warnings.map((w) => `<div class="card warn-card"><p>⚠️ ${esc(w.text)}</p>
    ${w.source ? `<p class="muted"><a href="${esc(w.source)}" target="_blank" rel="noopener">источник</a></p>` : ''}</div>`).join('');
}

export async function renderDay({ param }) {
  const days = await getDays();
  const i = days.findIndex((d) => d.date === param);
  if (i === -1) {
    return `<a class="back" href="#/plan">← Все дни</a><div class="card"><p>Такого дня нет в плане.</p></div>`;
  }
  const day = days[i];
  const prev = days[i - 1], next = days[i + 1];
  const saved = store.getMine(day.date);
  const places = await placeIndex([...new Set([...dayCities(day), ...saved.map((m) => m.city)].filter((c) => CITIES[c]))]);
  const mine = saved.filter((m) => places.has(`${m.city}/${m.place_id}`));
  const plan = activePlan(day.date);

  return `<div class="day-page"><a class="back" href="#/plan">← Все дни</a>
    <h1>${fmtWeekday(day.date)}, ${fmtDate(day.date)}</h1>
    <p class="day-city">${cityLine(day)}</p>
    ${badgesHTML(day)}
    ${day.note ? `<p class="muted">${esc(day.note)}</p>` : ''}
    ${warningsHTML(day.warnings)}
    ${budgetHTML(day, plan, mine, places)}
    <div class="seg plan-switch" role="group" aria-label="Вариант плана">
      <button type="button" data-plan="a" aria-pressed="${plan === 'a'}">План А</button>
      <button type="button" data-plan="b" aria-pressed="${plan === 'b'}">План Б · полегче</button>
    </div>
    ${plan === 'b' ? '<p class="muted">Облегчённый вариант — если устали или дождь.</p>' : ''}
    ${planHTML(plan === 'b' ? day.plan_b : day.plan_a, day, places)}
    ${mineHTML(mine, day, places)}
    ${eventsHTML(day.events)}
    <nav class="day-nav" aria-label="Соседние дни">
      <a class="btn secondary" ${prev ? `href="#/day/${prev.date}"` : 'aria-disabled="true"'}>← ${prev ? fmtDate(prev.date) : ''}</a>
      <a class="btn secondary" ${next ? `href="#/day/${next.date}"` : 'aria-disabled="true"'}>${next ? fmtDate(next.date) : ''} →</a>
    </nav></div>`;
}
