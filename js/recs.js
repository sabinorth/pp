// Советы: все рекомендации из планов дней с фильтрами и кнопкой «в мой день».
// #/recs?date=2026-10-06&city=paris&level=low, #/recs?tab=practical
import { CITIES, getDays } from './data.js';
import { placeIndex } from './days.js';
import { openSheet } from './sheet.js';
import { esc, fmtDate, fmtWeekday, EFFORT_LEVELS, BEST_TIME, effortInline } from './ui.js';
import * as plan from './plan.js';
import * as practical from './practical.js';

let recs = [];   // текущий список для обработчиков кнопок
let days = [];

// Пункты планов А и Б. Паузы внутри больших мест (обед в Версале) не отдельная рекомендация.
async function collect() {
  days = await getDays();
  const places = await placeIndex(Object.keys(CITIES));
  const byKey = new Map();
  for (const d of days) {
    for (const [plan, label] of [['plan_a', 'А'], ['plan_b', 'Б']]) {
      for (const it of d[plan] || []) {
        const city = it.city || d.city;
        const p = places.get(`${city}/${it.place_id}`);
        if (!p) continue;
        if (it.pause && !['cafe', 'rest'].includes(p.type)) continue;
        const key = `${d.date}/${city}/${p.id}`;
        if (byKey.has(key)) { byKey.get(key).plans.push(label); continue; }
        byKey.set(key, { date: d.date, city, item: it, place: p, plans: [label] });
      }
    }
  }
  return [...byKey.values()];
}

function segHTML(tab) {
  return `<nav class="seg seg-links" aria-label="Раздел советов">
    <a href="#/recs" aria-current="${tab !== 'practical' ? 'page' : 'false'}">💡 Рекомендации</a>
    <a href="#/recs?tab=practical" aria-current="${tab === 'practical' ? 'page' : 'false'}">🧭 Практическое</a>
  </nav>`;
}

function chip(group, value, label, current) {
  return `<button type="button" class="chip pick" data-group="${group}" data-value="${value}" aria-pressed="${current === value}">${label}</button>`;
}

function cardHTML(r, i) {
  const p = r.place;
  const bt = BEST_TIME[r.item.best_time];
  const level = r.item.pause ? 'low' : p.effort?.level;
  return `<article class="card rec" data-date="${r.date}" data-city="${r.city}" data-level="${level || ''}">
    <div class="rec-meta">
      <span class="badge">${fmtWeekday(r.date)}, ${fmtDate(r.date)}</span>
      <span class="badge">План ${r.plans.join(' и ')}</span>
      ${r.item.pause ? '<span class="badge">☕ пауза</span>' : ''}
      <span class="muted">${CITIES[r.city].flag} ${CITIES[r.city].name}</span>
    </div>
    <h3 class="rec-title">${esc(p.name)}${p.verified === false ? ' <span class="badge warn">не проверено</span>' : ''}</h3>
    ${bt ? `<p class="item-when">${bt.icon} ${bt.label}${r.item.best_time_why ? ` — ${esc(r.item.best_time_why)}` : ''}</p>` : ''}
    ${r.item.why ? `<p>${esc(r.item.why)}</p>` : ''}
    ${effortInline(p.effort)}
    <div class="rec-actions">
      <a class="btn secondary" href="#/map?city=${r.city}&place=${encodeURIComponent(p.id)}">📍 На карте</a>
      <button type="button" class="btn" data-add="${i}">➕ В мой день</button>
    </div>
  </article>`;
}

async function renderRecs(q) {
  recs = await collect();
  const date = q.date || '', city = q.city || '', level = q.level || '';
  const dateOpts = days.map((d) => `<option value="${d.date}"${d.date === date ? ' selected' : ''}>${fmtWeekday(d.date)}, ${fmtDate(d.date)} · ${CITIES[d.city].name}</option>`);
  return `<h1>Советы</h1>${segHTML('recs')}
    <div class="filters">
      <label class="field"><span>Дата</span>
        <select id="f-date"><option value="">Все дни</option>${dateOpts.join('')}</select></label>
      <div class="chips" role="group" aria-label="Город">
        ${chip('city', '', 'Оба города', city)}
        ${Object.entries(CITIES).map(([id, c]) => chip('city', id, `${c.flag} ${c.name}`, city)).join('')}
      </div>
      <div class="chips" role="group" aria-label="Нагрузка">
        ${chip('level', '', 'Любая нагрузка', level)}
        ${Object.entries(EFFORT_LEVELS).map(([id, l]) => chip('level', id, `${l.icon} ${l.label}`, level)).join('')}
      </div>
    </div>
    <p class="muted" id="rec-count"></p>
    <div id="rec-list">${recs.map(cardHTML).join('')}</div>`;
}

function applyFilters(el) {
  const f = {
    date: el.querySelector('#f-date').value,
    city: el.querySelector('.chip[data-group="city"][aria-pressed="true"]')?.dataset.value || '',
    level: el.querySelector('.chip[data-group="level"][aria-pressed="true"]')?.dataset.value || '',
  };
  let n = 0;
  for (const card of el.querySelectorAll('.rec')) {
    const show = (!f.date || card.dataset.date === f.date)
      && (!f.city || card.dataset.city === f.city)
      && (!f.level || card.dataset.level === f.level);
    card.hidden = !show;
    if (show) n++;
  }
  el.querySelector('#rec-count').textContent = n ? `Найдено: ${n}` : 'Ничего не нашлось — попробуйте убрать фильтр.';
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  history.replaceState(null, '', `#/recs${qs ? `?${qs}` : ''}`);
}

function openAddSheet(r) {
  const buttons = days.map((d) => `<button type="button" class="btn ${d.date === r.date ? '' : 'secondary'} day-pick" data-date="${d.date}">
      ${fmtWeekday(d.date)}, ${fmtDate(d.date)} ${CITIES[d.city].flag}</button>`);
  openSheet(`<h2>В мой день</h2>
    <p><strong>${esc(r.place.name)}</strong></p>
    <p class="muted">Выберите день. Рекомендуем: ${fmtDate(r.date)}.</p>
    <div class="day-picks">${buttons.join('')}</div>
    <p class="add-result" role="status"></p>`);
  const body = document.querySelector('#sheet .sheet-body');
  body.querySelector('.day-picks').addEventListener('click', (e) => {
    const btn = e.target.closest('.day-pick');
    if (!btn) return;
    const date = btn.dataset.date;
    const added = plan.add(date, { city: r.city, place_id: r.place.id });
    body.querySelector('.add-result').innerHTML = `${added ? '✅ Добавлено' : 'Уже есть'} в ${fmtDate(date)}. <a href="#/day/${date}">Открыть день →</a>`;
  });
}

export async function render(r) {
  if (r.query.tab === 'practical') {
    return `<h1>Советы</h1>${segHTML('practical')}${await practical.render(r.query.focus)}`;
  }
  return renderRecs(r.query);
}

export function after(el, r) {
  if (r.query.tab === 'practical') return practical.after(el, r.query.focus);
  el.querySelector('#f-date').addEventListener('change', () => applyFilters(el));
  el.querySelector('.filters').addEventListener('click', (e) => {
    const c = e.target.closest('.chip.pick');
    if (!c) return;
    for (const other of el.querySelectorAll(`.chip[data-group="${c.dataset.group}"]`)) {
      other.setAttribute('aria-pressed', String(other === c));
    }
    applyFilters(el);
  });
  el.querySelector('#rec-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (b) openAddSheet(recs[Number(b.dataset.add)]);
  });
  applyFilters(el);
}
