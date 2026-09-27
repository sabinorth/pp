// Карта: Leaflet + OSM, переключатель городов, фильтр по типам, шторка точки.
/* global L */
import { CITIES, getHotel, getPlaces, getGameIds, getDays } from './data.js';
import { pickerHTML } from './picker.js';
import { top8HTML } from './top8.js';
import { openSheet, closeSheet, isSheetOpen } from './sheet.js';
import { esc, TYPES, fmtDate, fmtWeekday, plural, effortHTML, effortInline, isRainy } from './ui.js';

let map = null;
let els = null;
let currentCity = null;
let currentHotel = null;
let currentPlaces = [];
let readyGames = [];
let tripDays = [];
let hotelMarker = null;
let routeLayer = null;        // пунктир маршрута открытой точки
let highlightLayer = null;    // кольца вокруг кандидатов идеи
const layers = {};            // слой → L.layerGroup
const hiddenLayers = new Set();

// Слои-чипы. Впечатления и события — один слой.
const LAYERS = [
  ...['sight', 'cafe', 'rest', 'toilet', 'park'].map((t) => ({ id: t, types: [t], ...TYPES[t] })),
  { id: 'fun', types: ['experience', 'event'], icon: '✨', label: 'Впечатления' },
];
function layerOf(type) {
  return (LAYERS.find((l) => l.types.includes(type)) || LAYERS[0]).id;
}

// ---------- ссылки ----------

function gmapsRoute(from, to) {
  return `https://www.google.com/maps/dir/?api=1&origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&travelmode=transit`;
}

function setHash(city, placeId) {
  const hash = placeId ? `#/map?city=${city}&place=${encodeURIComponent(placeId)}` : `#/map?city=${city}`;
  if (location.hash !== hash) history.replaceState(null, '', hash);
}

// ---------- инициализация ----------

function init(container) {
  container.innerHTML = `
    <div class="map-top">
      <div class="seg" role="group" aria-label="Город">
        ${Object.entries(CITIES).map(([id, c]) =>
          `<button type="button" data-city="${id}" aria-pressed="false">${c.flag} ${c.name}</button>`).join('')}
      </div>
      <div class="chips" role="group" aria-label="Слои">
        ${LAYERS.map((l) =>
          `<button type="button" class="chip" data-layer="${l.id}" aria-pressed="true">${l.icon} ${l.label}</button>`).join('')}
        <button type="button" class="chip chip-action" data-ideas>💭 Идеи</button>
      </div>
    </div>
    <div id="map"></div>`;

  els = {
    seg: container.querySelectorAll('.seg button'),
    chips: container.querySelectorAll('.chip[data-layer]'),
    ideas: container.querySelector('[data-ideas]'),
  };

  map = L.map(container.querySelector('#map'), { zoomControl: false });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  for (const l of LAYERS) layers[l.id] = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  highlightLayer = L.layerGroup().addTo(map);

  map.on('click', () => {
    closeSheet();
    highlightLayer.clearLayers();
  });
  els.ideas.addEventListener('click', openIdeas);
  // Кнопки внутри шторки карты.
  document.querySelector('#sheet .sheet-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-candidates]');
    if (b && !mapEl().hidden) showCandidates(b.dataset.candidates);
  });

  for (const btn of els.seg) {
    btn.addEventListener('click', () => {
      if (btn.dataset.city !== currentCity) location.hash = `#/map?city=${btn.dataset.city}`;
    });
  }
  for (const chip of els.chips) {
    chip.addEventListener('click', () => toggleLayer(chip.dataset.layer));
  }
}

const mapEl = () => document.getElementById('map-view');

function toggleLayer(id, forceOn = false) {
  const on = forceOn || hiddenLayers.has(id);
  if (on) {
    hiddenLayers.delete(id);
    map.addLayer(layers[id]);
  } else {
    hiddenLayers.add(id);
    map.removeLayer(layers[id]);
  }
  for (const chip of els.chips) {
    if (chip.dataset.layer === id) chip.setAttribute('aria-pressed', String(on));
  }
}

// ---------- маркеры ----------

function pinIcon(kind, icon, unverified, rainy = false) {
  const size = kind === 'hotel' ? 50 : 40;
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin pin-${kind}">${icon}${unverified ? '<b class="pin-unv" title="не проверено">?</b>' : ''}${rainy ? '<b class="pin-rain" title="на дождь">☔</b>' : ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

async function loadCity(city) {
  const [hotel, places, gameIds, days] = await Promise.all([getHotel(city), getPlaces(city), getGameIds(), getDays()]);
  readyGames = gameIds;
  tripDays = days;
  currentCity = city;
  currentHotel = hotel;
  currentPlaces = places;

  for (const g of Object.values(layers)) g.clearLayers();
  routeLayer.clearLayers();
  highlightLayer.clearLayers();
  hotelMarker?.remove();

  hotelMarker = L.marker(hotel.coords, {
    icon: pinIcon('hotel', '🏨', !hotel.verified),
    zIndexOffset: 1000,
    title: hotel.name,
    keyboard: true,
  }).addTo(map);
  hotelMarker.on('click', () => openHotel());

  const counts = {};
  for (const p of places) {
    if (!p.coords) continue;   // идеи без адреса — только в списке
    const t = TYPES[p.type] ? p.type : 'sight';
    const layer = layerOf(t);
    counts[layer] = (counts[layer] || 0) + 1;
    const m = L.marker(p.coords, { icon: pinIcon(t, TYPES[t].icon, !p.verified, isRainy(p)), title: p.name, keyboard: true });
    m.on('click', () => {
      setHash(city, p.id);
      openPlace(p);
    });
    layers[layer].addLayer(m);
  }

  for (const chip of els.chips) chip.disabled = !counts[chip.dataset.layer];
  els.ideas.disabled = !places.some((p) => p.type === 'idea');
  for (const btn of els.seg) btn.setAttribute('aria-pressed', String(btn.dataset.city === city));

  map.setView(hotel.coords, 14);
}

// Центрирует точку в верхней части экрана, чтобы её не закрывала шторка.
function focusOn(coords, zoom = 16) {
  const size = map.getSize();
  const pt = map.project(coords, zoom).add([0, size.y * 0.25]);
  map.setView(map.unproject(pt, zoom), zoom);
}

// ---------- шторка ----------

function hoursHTML(h) {
  if (!h) return '<p class="muted">Часы работы неизвестны.</p>';
  const checked = h.checked_on ? `проверено ${fmtDate(h.checked_on, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'не проверено';
  const src = h.source ? ` · <a href="${esc(h.source)}" target="_blank" rel="noopener">источник</a>` : '';
  return `<p>${esc(h.text)}</p><p class="muted">🕑 ${checked}${src}</p>`;
}

function priceHTML(price, booking) {
  const parts = [];
  if (price?.avg_check_eur != null) parts.push(`Средний чек ~${price.avg_check_eur} €`);
  if (price?.ticket_eur != null) parts.push(price.ticket_eur === 0 ? 'Вход бесплатный' : `Билет ${price.ticket_eur} €`);
  let html = parts.length ? `<p>💶 ${parts.join(' · ')}</p>` : '';
  if (price?.note) html += `<p class="muted">${esc(price.note)}</p>`;
  if (booking?.required) {
    html += booking.url
      ? `<p>🎟️ Нужна бронь: <a href="${esc(booking.url)}" target="_blank" rel="noopener">купить билет</a></p>`
      : '<p>🎟️ Нужна бронь заранее</p>';
  }
  return html || '<p class="muted">Нет данных о ценах.</p>';
}

function transitHTML(t) {
  if (!t) return '';
  const parts = [];
  if (t.from_hotel_min != null) parts.push(`~${t.from_hotel_min} мин от отеля`);
  if (t.transfers != null) {
    parts.push(t.transfers === 0 ? 'без пересадок' : `${t.transfers} ${plural(t.transfers, ['пересадка', 'пересадки', 'пересадок'])}`);
  }
  return `<h3>Дорога</h3><p>🚇 ${parts.join(' · ')}</p>${t.note ? `<p class="muted">${esc(t.note)}</p>` : ''}`;
}

function photoHTML(photos) {
  const ph = photos?.[0];
  if (!ph) return '';
  return `<figure class="place-photo">
    <img src="${esc(ph.url)}" alt="" loading="lazy">
    <figcaption>Фото: ${esc(ph.credit)} · ${esc(ph.license)} · <a href="${esc(ph.source)}" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption>
  </figure>`;
}

// ---------- поля впечатлений ----------

function listHTML(title, items, ordered = false, cls = '') {
  if (!items?.length) return '';
  const tag = ordered ? 'ol' : 'ul';
  return `<h3>${title}</h3><${tag} class="bul ${cls}">${items.map((t) => `<li>${esc(t)}</li>`).join('')}</${tag}>`;
}

function datesHTML(dates) {
  if (!dates?.length) return '';
  const rows = dates.map((d) => `<li>📅 ${fmtWeekday(d.date)}, ${fmtDate(d.date)}${d.time ? `, ${esc(d.time)}` : ''}${d.note ? ` <span class="muted">— ${esc(d.note)}</span>` : ''}</li>`);
  return `<h3>Даты</h3><ul class="bul plain">${rows.join('')}</ul>`;
}

function bestTimeHTML(bt) {
  if (!Array.isArray(bt) || !bt.length) return '';
  const rows = bt.map((b) => `<li>🕑 ${esc(b.time)}${b.note ? ` <span class="muted">— ${esc(b.note)}</span>` : ''}</li>`);
  return `<h3>Когда лучше</h3><ul class="bul plain">${rows.join('')}</ul>`;
}

function longHTML(text) {
  if (!text) return '';
  const paras = String(text).split(/\n\s*\n/).map((t) => `<p>${esc(t.trim())}</p>`);
  return `<details class="more"><summary>Подробнее</summary>${paras.join('')}</details>`;
}

function stopsHTML(stops) {
  if (!stops?.length) return '';
  const rows = stops.map((s) => `<li>${esc(s.name)}${s.note ? ` <span class="muted">— ${esc(s.note)}</span>` : ''}</li>`);
  return `<h3>Маршрут</h3><ol class="bul">${rows.join('')}</ol>`;
}

function placeLinks(title, ids) {
  const found = (ids || []).map((id) => currentPlaces.find((x) => x.id === id)).filter(Boolean);
  if (!found.length) return '';
  const links = found.map((x) => `<li><a href="#/map?city=${x.city}&place=${encodeURIComponent(x.id)}">${(TYPES[x.type] || TYPES.sight).icon} ${esc(x.name)}</a></li>`);
  return `<h3>${title}</h3><ul class="link-list">${links.join('')}</ul>`;
}

function placeHTML(p, hotel) {
  const type = TYPES[p.type] || TYPES.sight;
  const isIdea = p.type === 'idea';
  const idea = p.idea_id ? currentPlaces.find((x) => x.id === p.idea_id) : null;
  return `
    ${photoHTML(p.photos)}
    <h2 class="place-title">${type.icon} ${esc(p.name)}</h2>
    ${p.name_local ? `<p class="place-local" lang="${p.city === 'paris' ? 'fr' : 'cs'}">${esc(p.name_local)}</p>` : ''}
    <div class="place-meta">
      <span class="badge">${type.label}</span>
      ${isRainy(p) ? '<span class="badge">☔ на дождь</span>' : ''}
      ${p.verified ? '' : '<span class="badge warn">⚠️ не проверено</span>'}
    </div>
    ${idea ? `<p>💭 Вариант для идеи <a href="#/map?city=${idea.city}&place=${encodeURIComponent(idea.id)}">«${esc(idea.name)}»</a></p>` : ''}
    ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}
    ${pickerHTML(p, tripDays)}
    ${top8HTML(p)}
    ${longHTML(p.description_long)}
    ${datesHTML(p.dates)}
    ${bestTimeHTML(p.best_time)}
    ${listHTML('Советы', p.tips)}
    ${listHTML('Как сделать', p.how_to, true)}
    ${stopsHTML(p.route_stops)}
    ${isIdea ? placeLinks('Где можно', p.candidates) : ''}
    ${isIdea && p.candidates?.length ? `<div class="route-btns"><button type="button" class="btn secondary" data-candidates="${esc(p.id)}">📍 Показать на карте</button></div>` : ''}
    ${placeLinks('Удобно совместить', p.pairs_with)}
    <h3>Нагрузка</h3>
    ${effortHTML(p.effort)}
    ${p.coords ? `${transitHTML(p.transit_hint)}
    <div class="route-btns">
      <a class="btn" href="${gmapsRoute(hotel.coords, p.coords)}" target="_blank" rel="noopener">🧭 Маршрут от отеля</a>
      <a class="btn secondary" href="${gmapsRoute(p.coords, hotel.coords)}" target="_blank" rel="noopener">🏨 Маршрут в отель</a>
    </div>` : ''}
    ${isIdea ? '' : `<h3>Часы работы</h3>
    ${hoursHTML(p.hours)}
    <h3>Цены</h3>
    ${priceHTML(p.price, p.booking)}`}
    ${p.address ? `<p class="muted">📍 ${esc(p.address)}</p>` : ''}
    ${listHTML('Проверка фактов', p.fact_notes, false, 'muted')}
    ${readyGames.includes(p.game_id) ? `<div class="route-btns">
      <a class="btn game-link" href="#/game/${encodeURIComponent(p.game_id)}">🎲 Сыграть</a>
      ${isIdea ? '' : `<a class="btn secondary game-link" href="#/game/${encodeURIComponent(p.game_id)}?screen=onsite">📍 На месте</a>`}
    </div>` : ''}`;
}

// Пунктир маршрута от стартовой точки через остановки route_stops.
function drawRoute(p) {
  routeLayer.clearLayers();
  const stops = (p.route_stops || []).filter((s) => Array.isArray(s.coords));
  if (!stops.length) return;
  const pts = stops.map((s) => s.coords);
  if (p.coords && (pts[0][0] !== p.coords[0] || pts[0][1] !== p.coords[1])) pts.unshift(p.coords);
  L.polyline(pts, { className: 'route-line', weight: 4, dashArray: '8 10', interactive: false }).addTo(routeLayer);
  stops.forEach((s, i) => {
    L.marker(s.coords, {
      icon: L.divIcon({ className: 'pin-wrap', html: `<div class="stop-num">${i + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
      title: s.name,
      interactive: false,
    }).addTo(routeLayer);
  });
}

function openPlace(p) {
  const city = currentCity;
  drawRoute(p);
  openSheet(placeHTML(p, currentHotel), {
    // Убираем place из адреса, только если адрес всё ещё указывает на эту точку.
    onClose: () => {
      routeLayer.clearLayers();
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      if (location.hash.startsWith('#/map') && q.get('city') === city && q.get('place') === p.id) setHash(city);
    },
  });
}

// ---------- идеи ----------

function openIdeas() {
  const ideas = currentPlaces.filter((p) => p.type === 'idea');
  routeLayer.clearLayers();
  setHash(currentCity);
  const cards = ideas.map((p) => `<article class="card idea">
      <h3 class="rec-title"><a href="#/map?city=${p.city}&place=${encodeURIComponent(p.id)}">💭 ${esc(p.name)}</a>
        ${isRainy(p) ? '<span class="badge">☔ на дождь</span>' : ''}
        ${p.verified ? '' : '<span class="badge warn">не проверено</span>'}</h3>
      ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
      ${effortInline(p.effort)}
      <div class="rec-actions">
        ${p.candidates?.length ? `<button type="button" class="btn secondary" data-candidates="${esc(p.id)}">📍 Кандидаты на карте</button>` : ''}
        ${pickerHTML(p, tripDays)}
      </div>
    </article>`);
  openSheet(`<h2>💭 Идеи · ${CITIES[currentCity].name}</h2>
    <p class="muted">Впечатления без точного адреса. Можно посмотреть подходящие места на карте.</p>
    ${cards.join('') || '<p class="muted">Идей пока нет.</p>'}`);
}

function showCandidates(ideaId) {
  const idea = currentPlaces.find((p) => p.id === ideaId);
  const found = (idea?.candidates || []).map((id) => currentPlaces.find((x) => x.id === id)).filter((x) => x?.coords);
  closeSheet();
  highlightLayer.clearLayers();
  setHash(currentCity);
  if (!found.length) return;
  for (const p of found) {
    const layer = layerOf(p.type);
    if (hiddenLayers.has(layer)) toggleLayer(layer, true);
    L.marker(p.coords, {
      icon: L.divIcon({ className: 'pin-wrap', html: '<div class="pin-hl"></div>', iconSize: [60, 60], iconAnchor: [30, 30] }),
      interactive: false,
      zIndexOffset: -100,
    }).addTo(highlightLayer);
  }
  map.fitBounds(L.latLngBounds(found.map((p) => p.coords)), { padding: [70, 70], maxZoom: 16 });
}

function openHotel() {
  const h = currentHotel;
  routeLayer.clearLayers();
  setHash(currentCity);
  const checked = h.checked_on ? fmtDate(h.checked_on, { day: '2-digit', month: '2-digit', year: 'numeric' }) : null;
  openSheet(`
    <h2 class="place-title">🏨 ${esc(h.name)}</h2>
    <p class="place-local">${esc(h.name_local)}</p>
    <div class="place-meta">
      <span class="badge">Наш отель</span>
      ${h.verified ? '' : '<span class="badge warn">⚠️ не проверено</span>'}
    </div>
    <p>📍 ${esc(h.address)}</p>
    <p class="muted">${esc(h.note || '')}</p>
    ${checked ? `<p class="muted">🕑 адрес проверен ${checked}</p>` : ''}`);
}

// ---------- вход из роутера ----------

export async function show(container, query) {
  if (!map) init(container);
  map.invalidateSize();

  const city = CITIES[query.city] ? query.city : (currentCity || 'prague');
  if (city !== currentCity) {
    closeSheet();
    await loadCity(city);
  }

  if (query.candidates) {
    showCandidates(query.candidates);
  } else if (query.place) {
    const p = currentPlaces.find((x) => x.id === query.place);
    if (p) {
      if (p.coords && hiddenLayers.has(layerOf(p.type))) toggleLayer(layerOf(p.type), true);
      if (p.coords) focusOn(p.coords);
      openPlace(p);
    } else {
      closeSheet();
      setHash(city);
    }
  } else {
    if (isSheetOpen()) closeSheet();
    setHash(city);
  }
}
