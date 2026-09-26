// План по дням: лента (#/plan) и карточка дня (#/day/2026-10-08).
import { CITIES, getDays, getPlaces } from './data.js';
import { esc, fmtDate, fmtWeekday, todayISO, EFFORT_LEVELS } from './ui.js';

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
    const n = d.items?.length || 0;
    return `<a class="card day-card${d.date === today ? ' today' : ''}" href="#/day/${d.date}" data-date="${d.date}">
      <div class="day-head">
        <span class="day-date">${fmtWeekday(d.date)}, ${fmtDate(d.date)}</span>
        <span class="day-city">${cityLine(d)}</span>
        ${d.date === today ? '<span class="badge">сегодня</span>' : ''}
      </div>
      ${badgesHTML(d)}
      <div class="day-sub">${n ? `Пунктов: ${n}` : 'Пока пусто'}</div>
    </a>`;
  });
  return `<h1>План</h1><div class="days">${cards.join('')}</div>`;
}

export function afterList(el) {
  el.querySelector('.day-card.today')?.scrollIntoView({ block: 'center' });
}

async function placeIndex(cities) {
  const lists = await Promise.all(cities.map((c) => getPlaces(c)));
  const index = new Map();
  for (const p of lists.flat()) index.set(`${p.city}/${p.id}`, p);
  return index;
}

function itemHTML(item, day, places) {
  const city = item.city || day.city;
  const p = item.place_id ? places.get(`${city}/${item.place_id}`) : null;
  const lvl = p?.effort ? EFFORT_LEVELS[p.effort.level] : null;
  const title = esc(item.title || p?.name || '');
  const main = item.place_id
    ? `<a class="item-place" href="#/map?city=${city}&place=${encodeURIComponent(item.place_id)}">${lvl ? `<span title="Нагрузка: ${lvl.label}">${lvl.icon}</span>` : ''}${title} 🗺️</a>`
    : `<span>${title}</span>`;
  return `<li class="card item">
    <span class="item-time">${esc(item.time || '')}</span>
    <div class="item-main">${main}${item.note ? `<p class="muted">${esc(item.note)}</p>` : ''}</div>
  </li>`;
}

export async function renderDay({ param }) {
  const days = await getDays();
  const i = days.findIndex((d) => d.date === param);
  if (i === -1) {
    return `<a class="back" href="#/plan">← Все дни</a><div class="card"><p>Такого дня нет в плане.</p></div>`;
  }
  const day = days[i];
  const prev = days[i - 1], next = days[i + 1];
  const cities = [...new Set([day.city, day.city_from, ...(day.items || []).map((it) => it.city)].filter(Boolean))];
  const places = await placeIndex(cities);
  const items = day.items || [];

  return `<a class="back" href="#/plan">← Все дни</a>
    <h1>${fmtWeekday(day.date)}, ${fmtDate(day.date)}</h1>
    <p class="day-city">${cityLine(day)}</p>
    ${badgesHTML(day)}
    ${day.note ? `<p class="muted">${esc(day.note)}</p>` : ''}
    <h2 style="margin-top:16px">Пункты</h2>
    ${items.length ? `<ul class="items">${items.map((it) => itemHTML(it, day, places)).join('')}</ul>`
                   : '<div class="card"><p class="muted">Пока пусто.</p></div>'}
    <nav class="day-nav" aria-label="Соседние дни">
      <a class="btn secondary" ${prev ? `href="#/day/${prev.date}"` : 'aria-disabled="true"'}>← ${prev ? fmtDate(prev.date) : ''}</a>
      <a class="btn secondary" ${next ? `href="#/day/${next.date}"` : 'aria-disabled="true"'}>${next ? fmtDate(next.date) : ''} →</a>
    </nav>`;
}
