// Энергобюджет дня: low = 1, mid = 2, high = 3, +1 за каждые полные 3 км пешком.
// Паузы (кафе, отдых, туалет) не нагружают.
import * as store from './store.js';

export const DEFAULT_THRESHOLD = 5;
export const THRESHOLD_MIN = 3;
export const THRESHOLD_MAX = 10;
const LEVEL_POINTS = { low: 1, mid: 2, high: 3 };
const PAUSE_TYPES = ['cafe', 'rest', 'toilet'];

export function getThreshold() {
  const t = Number(store.get('threshold', DEFAULT_THRESHOLD));
  return Number.isInteger(t) && t >= THRESHOLD_MIN && t <= THRESHOLD_MAX ? t : DEFAULT_THRESHOLD;
}

export function setThreshold(t) {
  store.set('threshold', t);
}

export function itemPoints(item, place) {
  if (item.pause || !place?.effort || PAUSE_TYPES.includes(place.type)) return 0;
  const e = place.effort;
  return (LEVEL_POINTS[e.level] || 0) + Math.floor((e.walk_km || 0) / 3);
}

// places: Map «city/id» → место
export function score(items, defaultCity, places) {
  return items.reduce((sum, it) => sum + itemPoints(it, places.get(`${it.city || defaultCity}/${it.place_id}`)), 0);
}

export function meterHTML(value, threshold) {
  const total = Math.max(value, threshold);
  const segs = Array.from({ length: total }, (_, i) => {
    const cls = i < value ? (i < threshold ? 'on' : 'over') : '';
    return `<span class="seg-e ${cls}"></span>`;
  });
  const over = value > threshold;
  return `<div class="energy${over ? ' is-over' : ''}" role="img" aria-label="Нагрузка ${value} из ${threshold}">
    <div class="energy-head"><span>🔋 Нагрузка дня</span><strong>${value} из ${threshold}</strong></div>
    <div class="energy-bar">${segs.join('')}</div>
  </div>`;
}
