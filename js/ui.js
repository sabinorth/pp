// Общие помощники для разметки.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Шапка блока в духе MySpace: «Игрок 1's Top 8». Приставка видна только в эмо-теме.
// title — уже готовая разметка.
export function whose(title, who) {
  return `<span class="whose">${esc(who)}'s </span>${title}`;
}

export const TYPES = {
  sight:  { icon: '🏛️', label: 'Места' },
  cafe:   { icon: '☕', label: 'Кафе' },
  rest:   { icon: '🛋️', label: 'Отдых' },
  toilet: { icon: '🚻', label: 'Туалеты' },
  park:   { icon: '🌳', label: 'Парки' },
  experience: { icon: '✨', label: 'Впечатление' },
  event:  { icon: '🎭', label: 'Событие' },
  idea:   { icon: '💭', label: 'Идея' },
};

// Метка «подходит на дождь» — тег в place.tags.
export const RAIN_TAG = 'на дождь';
export const isRainy = (p) => Boolean(p?.tags?.includes(RAIN_TAG));

export const EFFORT_LEVELS = {
  low:  { icon: '🟢', label: 'лёгкая' },
  mid:  { icon: '🟡', label: 'средняя' },
  high: { icon: '🔴', label: 'тяжёлая' },
};

export const BEST_TIME = {
  morning: { icon: '🌅', label: 'утро' },
  day:     { icon: '☀️', label: 'день' },
  evening: { icon: '🌙', label: 'вечер' },
};

// «2026-10-05» → Date в локальном времени (без сдвига часового пояса).
export function parseISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso, opts = { day: 'numeric', month: 'long' }) {
  return parseISODate(iso).toLocaleDateString('ru-RU', opts);
}

export function fmtWeekday(iso) {
  const w = parseISODate(iso).toLocaleDateString('ru-RU', { weekday: 'short' });
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// plural(3, ['пересадка', 'пересадки', 'пересадок'])
export function plural(n, forms) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return forms[1];
  return forms[2];
}

export function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} мин`;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}

// ---------- нагрузка ----------

export const STAIRS = { none: 'Лестниц нет', some: 'Есть лестницы', many: 'Много лестниц' };
export const QUEUE = { none: 'Очереди нет', short: 'Очередь небольшая', long: 'Очередь длинная' };

export function effortHTML(e) {
  if (!e) return '<p class="muted">Нет данных о нагрузке.</p>';
  const lvl = EFFORT_LEVELS[e.level];
  const rows = [];
  if (lvl) rows.push(`<li class="level"><span class="ic">${lvl.icon}</span>Нагрузка: ${lvl.label}</li>`);
  if (e.walk_km != null) rows.push(`<li><span class="ic">🚶</span>${e.walk_km} км пешком</li>`);
  if (e.duration_min != null) rows.push(`<li><span class="ic">⏱️</span>${fmtDuration(e.duration_min)}</li>`);
  if (STAIRS[e.stairs]) rows.push(`<li><span class="ic">🪜</span>${STAIRS[e.stairs]}</li>`);
  if (QUEUE[e.queue]) rows.push(`<li><span class="ic">⏳</span>${QUEUE[e.queue]}</li>`);
  if (e.seating != null) rows.push(`<li><span class="ic">🪑</span>${e.seating ? 'Можно присесть' : 'Негде присесть'}</li>`);
  if (e.toilet != null) rows.push(`<li><span class="ic">🚻</span>${e.toilet ? 'Есть туалет' : 'Нет туалета'}</li>`);
  return `<ul class="effort">${rows.join('')}</ul>`;
}

// Короткая строка значков для карточек списка.
export function effortInline(e) {
  if (!e) return '';
  const lvl = EFFORT_LEVELS[e.level];
  const parts = [];
  if (lvl) parts.push(`<span class="eff lvl">${lvl.icon} ${lvl.label}</span>`);
  if (e.walk_km != null) parts.push(`<span class="eff" title="Пешком">🚶 ${e.walk_km} км</span>`);
  if (e.duration_min != null) parts.push(`<span class="eff" title="Длительность">⏱️ ${fmtDuration(e.duration_min)}</span>`);
  if (STAIRS[e.stairs]) parts.push(`<span class="eff">🪜 ${STAIRS[e.stairs].toLowerCase()}</span>`);
  if (QUEUE[e.queue]) parts.push(`<span class="eff">⏳ ${QUEUE[e.queue].toLowerCase()}</span>`);
  if (e.seating != null) parts.push(`<span class="eff">🪑 ${e.seating ? 'можно сесть' : 'негде сесть'}</span>`);
  if (e.toilet != null) parts.push(`<span class="eff">🚻 ${e.toilet ? 'есть' : 'нет'}</span>`);
  return `<div class="eff-row">${parts.join('')}</div>`;
}
