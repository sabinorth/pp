// «Проверка дня»: замечания по видимым пунктам плана. Считается по данным, работает офлайн.
// Порядок строк: ⚠️ закрыто → ⏰ часы → ✈️ перелёт → 🎟 бронь → 🚇 забастовка → 😴 нагрузка, иначе ✅.
import { loadJSON } from './data.js';
import { esc, fmtDate, parseISODate } from './ui.js';
import { dayWarnings } from './picker.js';
import * as energy from './energy.js';

export const getHotels = () => loadJSON('hotels.json');

// Дни перелёта (заезд или выезд из отеля): порог нагрузки ниже.
const TRAVEL_CUT = 2;

export function isTravelDay(date, hotels) {
  return hotels.some((h) => h.dates?.checkin === date || h.dates?.checkout === date);
}

export function dayThreshold(date, hotels) {
  const t = energy.getThreshold();
  return isTravelDay(date, hotels) ? Math.max(2, t - TRAVEL_CUT) : t;
}

// Нагрузка видимых пунктов и порог дня.
export function dayLoad(day, list, places, hotels) {
  const value = energy.score(list.filter((e) => !e.hidden).map((e) => e.item), day.city, places);
  return { value, limit: dayThreshold(day.date, hotels), travel: isTravelDay(day.date, hotels) };
}

const mins = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Открыто ли в time («HH:MM») по hours.slots. null — часов в данных нет.
// Интервал с концом раньше начала (["19:00","02:00"]) идёт за полночь.
export function openAt(hours, date, time) {
  const s = hours?.slots;
  if (!s || !time) return null;
  const wd = parseISODate(date).getDay();
  const t = mins(time);
  const today = (s[wd] || []).some(([a, b]) => (mins(b) > mins(a) ? t >= mins(a) && t < mins(b) : t >= mins(a)));
  const night = (s[(wd + 6) % 7] || []).some(([a, b]) => mins(b) < mins(a) && t < mins(b));
  return today || night;
}

function slotsText(hours, date) {
  const s = hours.slots[parseISODate(date).getDay()] || [];
  return s.map(([a, b]) => `${a}–${b}`).join(', ');
}

// Дата (и время) после выезда из отеля этого города.
export function afterLeave(hotel, date, time) {
  const { checkout, leave_time: leave } = hotel?.dates || {};
  if (!checkout) return false;
  return date > checkout || (date === checkout && (!time || !leave || time >= leave));
}

const nameOf = (e, p) => esc(e.item.title || p?.name || '');

export function dayChecks({ day, active, list, places, hotels }) {
  const rows = { closed: [], hours: [], flight: [], booking: [] };
  const noHours = [];
  const booked = new Set();
  for (const e of list.filter((x) => !x.hidden)) {
    const city = e.item.city || day.city;
    const p = e.item.place_id ? places.get(`${city}/${e.item.place_id}`) : null;
    if (!p) continue;
    const name = nameOf(e, p);
    // Пауза внутри большого места (обед в Версале) — проверяем только время перелёта.
    const inside = e.item.pause && !['cafe', 'rest'].includes(p.type);

    // ⚠️ закрыто или события нет; у маршрута — ещё и по остановкам.
    const w = inside ? [] : dayWarnings(p, day.date);
    const closed = w.includes('в этот день закрыто');
    if (w.length) rows.closed.push(`<strong>${name}</strong>: ${w.join(', ')}`);
    const stops = (p.route_stops || [])
      .map((s) => s.place_id && places.get(`${city}/${s.place_id}`))
      .filter((s) => s && dayWarnings(s, day.date).length);
    if (stops.length) rows.closed.push(`<strong>${name}</strong>: в этот день закрыто — ${stops.map((s) => esc(s.name)).join(', ')}`);

    // ⏰ время вне часов работы (если день не закрыт целиком).
    const open = closed || inside ? true : openAt(p.hours, day.date, e.time);
    if (open === false) {
      const hrs = slotsText(p.hours, day.date);
      rows.hours.push(`<strong>${name}</strong> в ${esc(e.time)}: ${hrs ? `открыто ${hrs}` : 'в этот день не работает'}`);
    } else if (open === null && e.time && p.type !== 'idea') {
      noHours.push(name);
    }

    // ✈️ до заселения или после выезда (по отелю города пункта).
    const d = hotels.find((h) => h.city === city)?.dates || {};
    if (d.checkout === day.date && d.leave_time) {
      if (e.time && e.time >= d.leave_time) rows.flight.push(`<strong>${name}</strong> в ${esc(e.time)} — после выезда из отеля в ${d.leave_time}`);
      else if (!e.time && !e.base) rows.flight.push(`<strong>${name}</strong>: выезд из отеля в ${d.leave_time} — поставьте время до него или перенесите`);
    }
    if (d.checkin === day.date && d.arrive_time && e.time && e.time < d.arrive_time) {
      rows.flight.push(`<strong>${name}</strong> в ${esc(e.time)} — раньше, чем доберёмся до отеля (~${d.arrive_time})`);
    }

    // 🎟 нужна бронь.
    if (p.booking?.required && !inside && !booked.has(p.id)) {
      booked.add(p.id);
      rows.booking.push(p.booking.url
        ? `<strong>${name}</strong>: нужна бронь — <a href="${esc(p.booking.url)}" target="_blank" rel="noopener">купить билет</a>`
        : `<strong>${name}</strong>: нужна бронь заранее`);
    }
  }

  const out = [
    ...rows.closed.map((html) => ({ icon: '⚠️', html })),
    ...rows.hours.map((html) => ({ icon: '⏰', html })),
    ...rows.flight.map((html) => ({ icon: '✈️', html })),
    ...rows.booking.map((html) => ({ icon: '🎟', html })),
  ];

  // 🚇 забастовка: полный текст из days.json → warnings (kind: "strike").
  const strikes = (day.warnings || []).filter((w) => w.kind === 'strike');
  if (strikes.length) {
    const body = strikes.map((w) => {
      const links = [
        w.source ? `<a href="${esc(w.source)}" target="_blank" rel="noopener">источник</a>` : '',
        w.checked_on ? `проверено ${fmtDate(w.checked_on)}` : '',
      ].filter(Boolean).join(' · ');
      return `<p>${esc(w.text)}</p>${links ? `<p class="muted src">${links}</p>` : ''}`;
    }).join('');
    out.push({
      icon: '🚇',
      cls: 'strike',
      html: `<details><summary><strong>Забастовка RATP</strong> — утром проверить, что ходит</summary>${body}
        <p><a href="#/recs?tab=practical&focus=transfers">Варианты и трансферы →</a></p></details>`,
    });
  }

  // 😴 перегрузка.
  const { value, limit, travel } = dayLoad(day, list, places, hotels);
  if (value > limit) {
    const why = travel ? ` Порог снижен до ${limit}: день перелёта.` : '';
    out.push({
      icon: '😴',
      html: active === 'a' && day.plan_b?.length
        ? `Нагрузка ${value} из ${limit} — насыщенно. Может, взять план Б?${why}
           <button type="button" class="btn" data-plan="b">Переключить на план Б</button>`
        : `Нагрузка ${value} из ${limit} — много. Можно убрать что-то из списка: отдых важнее.${why}`,
    });
  }

  return { rows: out, noHours, overloaded: value > limit };
}

export function checksHTML(res) {
  const rows = res.rows.length
    ? res.rows.map((r) => `<li class="check${r.cls ? ` ${r.cls}` : ''}"><span class="check-ic" aria-hidden="true">${r.icon}</span><div class="check-body">${r.html}</div></li>`).join('')
    : '<li class="check ok"><span class="check-ic" aria-hidden="true">✅</span><div class="check-body">Всё ок: закрытий, накладок со временем и перегрузки нет.</div></li>';
  const note = res.noHours.length
    ? `<p class="muted check-note">Время у ${res.noHours.join(', ')} не проверено: часов работы нет в данных.</p>`
    : '';
  return `<ul class="checks">${rows}</ul>${note}`;
}

// Короткие строки для текстового экспорта дня (без забастовки и нагрузки).
export function checksText(res) {
  const tmp = document.createElement('div');
  return res.rows
    .filter((r) => ['⚠️', '⏰', '✈️', '🎟'].includes(r.icon))
    .map((r) => {
      tmp.innerHTML = r.html;
      const a = tmp.querySelector('a[href^="http"]');
      return `${r.icon} ${tmp.textContent.replace(/\s+/g, ' ').trim()}${a ? ` ${a.href}` : ''}`;
    });
}
