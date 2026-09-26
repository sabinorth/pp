// Общие помощники для разметки.

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

export const TYPES = {
  sight:  { icon: '🏛️', label: 'Места' },
  cafe:   { icon: '☕', label: 'Кафе' },
  rest:   { icon: '🛋️', label: 'Отдых' },
  toilet: { icon: '🚻', label: 'Туалеты' },
  park:   { icon: '🌳', label: 'Парки' },
};

export const EFFORT_LEVELS = {
  low:  { icon: '🟢', label: 'лёгкая' },
  mid:  { icon: '🟡', label: 'средняя' },
  high: { icon: '🔴', label: 'тяжёлая' },
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
