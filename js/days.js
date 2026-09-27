// План по дням: лента (#/plan) и карточка дня (#/day/2026-10-08).
// Пункты дня = базовые из days.json + ручные правки из plan.js.
import { CITIES, getDays, getPlaces, getGameIds } from './data.js';
import { esc, fmtDate, fmtWeekday, todayISO, parseISODate, plural, EFFORT_LEVELS, BEST_TIME, TYPES, whose } from './ui.js';
import { crewName } from './players.js';
import { blinkiesHTML } from './theme.js';
import * as top8 from './top8.js';
import * as store from './store.js';
import * as plan from './plan.js';
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

function rerender() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// Счётчик в стиле visitor counter: дни до поездки и пройденные игры.
function digitsHTML(n, width) {
  return `<span class="counter-digits" aria-hidden="true">${[...String(n).padStart(width, '0')].map((c) => `<span>${c}</span>`).join('')}</span>`;
}

function counterRow(label, n, width, tail, sr) {
  return `<p class="counter-row"><span class="counter-label">${label}</span>${digitsHTML(n, width)}<span class="counter-tail" aria-hidden="true">${tail}</span><span class="sr-only">${sr}</span></p>`;
}

async function counterHTML(days) {
  const today = parseISODate(todayISO());
  const first = parseISODate(days[0].date);
  const total = days.length;
  const n = Math.round((first - today) / 86400000);
  let tripRow;
  if (n > 0) tripRow = counterRow('до поездки', n, 3, plural(n, ['день', 'дня', 'дней']), `${n} ${plural(n, ['день', 'дня', 'дней'])}`);
  else if (-n < total) tripRow = counterRow('день поездки', 1 - n, 2, `из ${total}`, `${1 - n} из ${total}`);
  else tripRow = '<p class="counter-row"><span class="counter-label">поездка завершена 🖤</span></p>';
  const ids = await getGameIds().catch(() => []);
  const doneAll = store.get('games.done', {}) || {};
  const done = ids.filter((id) => doneAll[id]?.achievement).length;
  return `<div class="counter">${tripRow}${counterRow('игр пройдено', done, 2, `/ ${ids.length}`, `${done} из ${ids.length}`)}</div>`;
}

export async function renderList({ query }) {
  const days = await getDays();
  const places = await placeIndex(Object.keys(CITIES));
  const today = todayISO();
  const cards = days.map((d) => {
    const titles = plan.visibleEntries(d, plan.activePlan(d.date)).filter((e) => !e.item.pause).length;
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
  return `<h1>План</h1>${blinkiesHTML()}${await counterHTML(days)}${importOfferHTML(query.import)}<div class="days">${cards.join('')}</div>
    <div class="top8s">${top8.gridsHTML(places)}</div>
    <section class="share-plan" id="share">
      <h2 class="section mod-head">${whose('📲 План на двоих', crewName())}</h2>
      <p class="muted">Ручные правки хранятся только на этом телефоне. Перенести их на другой — файлом или ссылкой.</p>
      <div class="share-btns">
        <button type="button" class="btn secondary" data-export>⬇️ Экспорт плана</button>
        <label class="btn secondary">⬆️ Импорт плана<input type="file" accept="application/json,.json" data-import hidden></label>
        <button type="button" class="btn" data-share>🔗 Поделиться ссылкой</button>
      </div>
      <p class="add-result" id="share-msg" role="status"></p>
    </section>`;
}

// Ссылка #/plan?import=… : сначала спрашиваем, потом заменяем.
function importOfferHTML(code) {
  if (!code) return '';
  try {
    const s = plan.importSummary(plan.parseImport(plan.decode(code)));
    return `<div class="card soft-warn" id="import-offer">
      <p><strong>Открыта ссылка с планом.</strong> Дней с правками: ${s.days}, добавлено пунктов: ${s.added}, скрыто: ${s.hidden}.</p>
      <p>Заменить им ваш текущий план на этом телефоне?</p>
      <div class="share-btns">
        <button type="button" class="btn" data-import-link>Заменить мой план</button>
        <a class="btn secondary" href="#/plan">Не надо</a>
      </div></div>`;
  } catch {
    return '<div class="card warn-card"><p>⚠️ Ссылка с планом повреждена — попросите прислать ещё раз.</p></div>';
  }
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function shareLink(msg) {
  const url = `${location.origin}${location.pathname}#/plan?import=${plan.encode(plan.exportData())}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'План: Прага + Париж', url });
      return;
    }
    await navigator.clipboard.writeText(url);
    msg.textContent = '✅ Ссылка скопирована — отправьте её подруге.';
  } catch (err) {
    if (err?.name === 'AbortError') return;
    msg.innerHTML = `Скопируйте ссылку вручную:<br><input class="share-url" readonly value="${esc(url)}">`;
    msg.querySelector('input').select();
  }
}

export function afterList(el, r) {
  if (!r?.query.import) el.querySelector('.day-card.today')?.scrollIntoView({ block: 'center' });
  const msg = el.querySelector('#share-msg');
  el.querySelector('[data-export]').addEventListener('click', () => {
    download(`plan-praga-parizh-${todayISO()}.json`, JSON.stringify(plan.exportData(), null, 2));
    msg.textContent = '✅ Файл сохранён. Его можно отправить в мессенджере и открыть через «Импорт плана».';
  });
  el.querySelector('[data-share]').addEventListener('click', () => shareLink(msg));
  el.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = plan.parseImport(JSON.parse(await file.text()));
      const s = plan.importSummary(data);
      if (!confirm(`В файле дней с правками: ${s.days}, добавлено пунктов: ${s.added}. Заменить им ваш текущий план?`)) return;
      plan.applyImport(data);
      rerender();
    } catch (err) {
      msg.textContent = `⚠️ Не получилось прочитать файл: ${err instanceof SyntaxError ? 'он повреждён' : err.message}`;
    }
  });
  el.querySelector('[data-import-link]')?.addEventListener('click', () => {
    plan.applyImport(plan.parseImport(plan.decode(r.query.import)));
    location.hash = '#/plan';
  });
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

// ---------- пункты дня ----------

const showHidden = new Set();   // даты, где раскрыты скрытые пункты

// Заметка к пункту — «стена комментариев» в эмо-теме, обычная заметка в обычной.
function wallHTML(note) {
  return `<div class="wall-comment">
    <span class="wall-ava" aria-hidden="true"><span class="emo-only">🖤</span><span class="not-emo">📝</span></span>
    <div class="wall-body"><p class="wall-who emo-only">${esc(crewName())} wrote:</p><p class="item-note">${esc(note)}</p></div>
  </div>`;
}

// «Песня дня» — просто текст, без плеера.
function getSongs() {
  const s = store.get('songs', {});
  return s && typeof s === 'object' ? s : {};
}

function songHTML(date) {
  return `<form class="listening" data-song>
    <label for="song">🎧 Currently listening:</label>
    <div class="listening-row">
      <input id="song" name="song" type="text" maxlength="100" autocomplete="off" placeholder="песня дня" value="${esc(getSongs()[date] || '')}">
      <button type="submit" class="icon-btn" aria-label="Сохранить песню">✓</button>
    </div>
  </form>`;
}

function saveSong(date, text) {
  const songs = { ...getSongs() };
  const t = text.trim().slice(0, 100);
  if (t) songs[date] = t;
  else delete songs[date];
  store.set('songs', songs);
}

function entryHTML(e, day, places, n, total) {
  const item = e.item;
  const city = item.city || day.city;
  const p = item.place_id ? places.get(`${city}/${item.place_id}`) : null;
  const lvl = !item.pause && p?.effort ? EFFORT_LEVELS[p.effort.level] : null;
  const icon = item.pause ? '☕' : (lvl ? `<span title="Нагрузка: ${lvl.label}">${lvl.icon}</span>` : '');
  const typeIcon = !e.base && p && ['experience', 'event', 'idea'].includes(p.type) ? TYPES[p.type].icon : '';
  const title = esc(item.title || p?.name || '');
  const time = e.time ? `<span class="item-time">${esc(e.time)}</span>` : '';
  const main = item.place_id
    ? `<a class="item-place" href="#/map?city=${city}&place=${encodeURIComponent(item.place_id)}">${time}${icon}${typeIcon}${title} 🗺️</a>`
    : `<span class="item-place">${time}${icon}${title}</span>`;
  const bt = BEST_TIME[item.best_time];
  const when = bt ? `<p class="item-when">${bt.icon} ${bt.label}${item.best_time_why ? ` — ${esc(item.best_time_why)}` : ''}</p>` : '';
  const k = esc(e.key);
  const ctrls = e.hidden
    ? `<button type="button" class="icon-btn" data-restore="${k}" aria-label="Вернуть в план" title="Вернуть">↩︎</button>`
    : `<button type="button" class="icon-btn" data-move="-1" data-key="${k}" aria-label="Выше"${n === 0 ? ' disabled' : ''}>↑</button>
       <button type="button" class="icon-btn" data-move="1" data-key="${k}" aria-label="Ниже"${n === total - 1 ? ' disabled' : ''}>↓</button>
       <button type="button" class="icon-btn" data-remove="${k}" aria-label="${e.base ? 'Убрать из плана' : 'Удалить'}" title="${e.base ? 'Убрать' : 'Удалить'}">✕</button>`;
  const edit = e.hidden ? '' : `<details class="item-edit"><summary>✎ ${e.time || e.note ? 'Изменить время и заметку' : 'Время и заметка'}<span class="emo-only">&nbsp;· 💬 comment</span></summary>
      <form data-meta="${k}">
        <label class="field"><span>Время</span><input type="time" name="time" value="${esc(e.time)}"></label>
        <label class="field"><span>Заметка</span><textarea name="note" rows="2" maxlength="500">${esc(e.note)}</textarea></label>
        <button type="submit" class="btn">Сохранить</button>
      </form></details>`;
  return `<li class="card item${item.pause ? ' pause' : ''}${e.hidden ? ' is-hidden' : ''}">
    <div class="item-main">${main}
      ${e.base ? '' : '<span class="badge">добавлено</span>'}${e.hidden ? ' <span class="badge">скрыто</span>' : ''}
      ${when}${item.why ? `<p class="muted">${esc(item.why)}</p>` : ''}
      ${e.note ? wallHTML(e.note) : ''}
      ${edit}
    </div>
    <div class="item-ctrls">${ctrls}</div>
  </li>`;
}

function listHTML(list, day, places) {
  const visible = list.filter((e) => !e.hidden);
  const hidden = list.filter((e) => e.hidden);
  const open = showHidden.has(day.date);
  const rows = open ? list : visible;
  let n = 0;
  const items = rows.map((e) => entryHTML(e, day, places, e.hidden ? -1 : n++, visible.length));
  const body = items.length
    ? `<ol class="items">${items.join('')}</ol>`
    : '<div class="card"><p class="muted">Пока пусто.</p></div>';
  const toggle = hidden.length
    ? `<button type="button" class="btn secondary wide" data-toggle-hidden>${open ? 'Не показывать скрытые' : `Показать скрытые (${hidden.length})`}</button>`
    : '';
  return `<section id="day-items">${body}${toggle}
    <p class="muted">Добавить своё: «+ В план» в шторке места на карте или в «Советах».</p></section>`;
}

function budgetHTML(day, active, list, places) {
  const value = energy.score(list.filter((e) => !e.hidden).map((e) => e.item), day.city, places);
  const limit = energy.getThreshold();
  let hint = '';
  if (value > limit) {
    hint = active === 'a'
      ? `<div class="card soft-warn"><p>Сегодня насыщенно. Может, взять план Б? Он спокойнее.</p>
          <button type="button" class="btn" data-plan="b">Переключить на план Б</button></div>`
      : `<div class="card soft-warn"><p>Даже с планом Б получается много. Можно убрать что-то из списка — отдых важнее.</p></div>`;
  }
  return `${energy.moodHTML(value, limit)}${energy.meterHTML(value, limit)}
    <p class="muted energy-note">Порог ${limit} меняется в <a href="#/recs?tab=practical&focus=settings">настройках</a>.</p>${hint}`;
}

export function afterDay(el, r) {
  const page = el.querySelector('.day-page');
  if (!page) return;
  page.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const date = r.param;
    if (b.dataset.plan) {
      if (b.getAttribute('aria-pressed') === 'true') return;
      plan.setActivePlan(date, b.dataset.plan);
    } else if (b.dataset.move) {
      const day = (await getDays()).find((d) => d.date === date);
      plan.move(day, plan.activePlan(date), b.dataset.key, Number(b.dataset.move));
    } else if (b.dataset.remove) {
      plan.remove(date, b.dataset.remove);
    } else if (b.dataset.restore) {
      plan.restore(date, b.dataset.restore);
    } else if (b.hasAttribute('data-toggle-hidden')) {
      if (showHidden.has(date)) showHidden.delete(date);
      else showHidden.add(date);
    } else {
      return;
    }
    const y = window.scrollY;
    rerender();
    requestAnimationFrame(() => window.scrollTo(0, y));
  });
  page.addEventListener('change', (e) => {
    if (e.target.name === 'song') saveSong(r.param, e.target.value);
  });
  page.addEventListener('submit', (e) => {
    if (e.target.matches('form[data-song]')) {
      e.preventDefault();
      saveSong(r.param, e.target.song.value);
      e.target.song.blur();
      return;
    }
    const form = e.target.closest('form[data-meta]');
    if (!form) return;
    e.preventDefault();
    plan.setMeta(r.param, form.dataset.meta, { time: form.time.value, note: form.note.value });
    const y = window.scrollY;
    rerender();
    requestAnimationFrame(() => window.scrollTo(0, y));
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
  return `<h2 class="section mod-head">${whose('🎭 События', crewName())}</h2><ul class="items">${cards.join('')}</ul>`;
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
  const active = plan.activePlan(day.date);
  const all = plan.entries(day, active);
  const places = await placeIndex([...new Set([...dayCities(day), ...all.map((e) => e.item.city)].filter((c) => CITIES[c]))]);
  // Добавленные пункты, которых больше нет в данных, не показываем.
  const list = all.filter((e) => e.base || places.has(`${e.item.city}/${e.item.place_id}`));

  return `<div class="day-page"><a class="back" href="#/plan">← Все дни</a>
    <h1>${fmtWeekday(day.date)}, ${fmtDate(day.date)}</h1>
    <p class="day-city">${cityLine(day)}</p>
    ${blinkiesHTML(day.date)}
    ${badgesHTML(day)}
    ${songHTML(day.date)}
    ${day.note ? `<p class="muted">${esc(day.note)}</p>` : ''}
    ${warningsHTML(day.warnings)}
    ${budgetHTML(day, active, list, places)}
    <div class="seg plan-switch" role="group" aria-label="Вариант плана">
      <button type="button" data-plan="a" aria-pressed="${active === 'a'}">План А</button>
      <button type="button" data-plan="b" aria-pressed="${active === 'b'}">План Б · полегче</button>
    </div>
    ${active === 'b' ? '<p class="muted">Облегчённый вариант — если устали или дождь.</p>' : ''}
    ${listHTML(list, day, places)}
    ${eventsHTML(day.events)}
    <nav class="day-nav" aria-label="Соседние дни">
      <a class="btn secondary" ${prev ? `href="#/day/${prev.date}"` : 'aria-disabled="true"'}>← ${prev ? fmtDate(prev.date) : ''}</a>
      <a class="btn secondary" ${next ? `href="#/day/${next.date}"` : 'aria-disabled="true"'}>${next ? fmtDate(next.date) : ''} →</a>
    </nav></div>`;
}
