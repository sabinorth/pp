// «+ В план»: выбор дня прямо в шторке. Только дни, когда мы в городе точки.
// Если день не совпадает с датами события или место в этот день закрыто — мягкое
// предупреждение, но добавить всё равно можно.
import { CITIES } from './data.js';
import { esc, fmtDate, fmtWeekday, parseISODate } from './ui.js';
import * as plan from './plan.js';

export function dayWarnings(p, date) {
  const w = [];
  if (p.dates?.length && !p.dates.some((d) => d.date === date)) w.push('в этот день события нет');
  if (p.hours?.closed_weekdays?.includes(parseISODate(date).getDay())) w.push('в этот день закрыто');
  return w;
}

export function cityDays(days, city) {
  return days.filter((d) => d.city === city || d.city_from === city);
}

function dayBtn(p, d, recommended) {
  const w = dayWarnings(p, d.date);
  const added = plan.hasAdded(d.date, p.city, p.id);
  return `<button type="button" class="btn ${d.date === recommended ? '' : 'secondary'} day-pick" data-add-date="${d.date}" data-warn="${esc(w.join(', '))}">
      <span>${fmtWeekday(d.date)}, ${fmtDate(d.date)} ${CITIES[d.city].flag}${added ? ' ✓' : ''}</span>
      ${w.length ? `<small class="pick-warn">⚠️ ${w.join(', ')}</small>` : ''}
    </button>`;
}

// Раскрывающийся блок с кнопками дней. open — сразу раскрыт.
export function pickerHTML(p, days, { recommended = '', open = false } = {}) {
  const list = cityDays(days, p.city);
  if (!list.length) return '';
  return `<details class="add-plan" data-city="${esc(p.city)}" data-place="${esc(p.id)}"${open ? ' open' : ''}>
    <summary class="btn">➕ В план</summary>
    <p class="muted">Выберите день${recommended ? `. Рекомендуем: ${fmtDate(recommended)}` : ''}.</p>
    <div class="day-picks">${list.map((d) => dayBtn(p, d, recommended)).join('')}</div>
    <p class="add-result" role="status"></p>
  </details>`;
}

// Один обработчик на всю шторку: блоки .add-plan рисуются в ней заново.
document.querySelector('#sheet .sheet-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-date]');
  const box = btn?.closest('.add-plan');
  if (!box) return;
  const date = btn.dataset.addDate;
  const { city, place } = box.dataset;
  const added = plan.add(date, { city, place_id: place });
  const w = btn.dataset.warn;
  if (added && !btn.textContent.includes('✓')) btn.querySelector('span').append(' ✓');
  box.querySelector('.add-result').innerHTML = `${added ? '✅ Добавлено' : 'Уже есть'} в ${fmtDate(date)}${w ? ` (⚠️ ${esc(w)})` : ''}. <a href="#/day/${date}">Открыть день →</a>`;
});
