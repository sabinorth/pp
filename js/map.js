// Карта: Leaflet + OSM, переключатель городов, фильтр по типам, шторка точки.
/* global L */
import { CITIES, getHotel, getPlaces } from './data.js';
import { openSheet, closeSheet, isSheetOpen } from './sheet.js';
import { esc, TYPES, fmtDate, plural, effortHTML } from './ui.js';

let map = null;
let els = null;
let currentCity = null;
let currentHotel = null;
let currentPlaces = [];
let hotelMarker = null;
const layers = {};            // type → L.layerGroup
const hiddenTypes = new Set();

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
        ${Object.entries(TYPES).map(([type, t]) =>
          `<button type="button" class="chip" data-type="${type}" aria-pressed="true">${t.icon} ${t.label}</button>`).join('')}
      </div>
    </div>
    <div id="map"></div>`;

  els = {
    seg: container.querySelectorAll('.seg button'),
    chips: container.querySelectorAll('.chip'),
  };

  map = L.map(container.querySelector('#map'), { zoomControl: false });
  L.control.zoom({ position: 'topright' }).addTo(map);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  for (const type of Object.keys(TYPES)) layers[type] = L.layerGroup().addTo(map);

  map.on('click', closeSheet);

  for (const btn of els.seg) {
    btn.addEventListener('click', () => {
      if (btn.dataset.city !== currentCity) location.hash = `#/map?city=${btn.dataset.city}`;
    });
  }
  for (const chip of els.chips) {
    chip.addEventListener('click', () => toggleType(chip.dataset.type));
  }
}

function toggleType(type, forceOn = false) {
  const on = forceOn || hiddenTypes.has(type);
  if (on) {
    hiddenTypes.delete(type);
    map.addLayer(layers[type]);
  } else {
    hiddenTypes.add(type);
    map.removeLayer(layers[type]);
  }
  for (const chip of els.chips) {
    if (chip.dataset.type === type) chip.setAttribute('aria-pressed', String(on));
  }
}

// ---------- маркеры ----------

function pinIcon(kind, icon, unverified) {
  const size = kind === 'hotel' ? 50 : 40;
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin pin-${kind}">${icon}${unverified ? '<b class="pin-unv" title="не проверено">?</b>' : ''}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

async function loadCity(city) {
  const [hotel, places] = await Promise.all([getHotel(city), getPlaces(city)]);
  currentCity = city;
  currentHotel = hotel;
  currentPlaces = places;

  for (const g of Object.values(layers)) g.clearLayers();
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
    const t = TYPES[p.type] ? p.type : 'sight';
    counts[t] = (counts[t] || 0) + 1;
    const m = L.marker(p.coords, { icon: pinIcon(t, TYPES[t].icon, !p.verified), title: p.name, keyboard: true });
    m.on('click', () => {
      setHash(city, p.id);
      openPlace(p);
    });
    layers[t].addLayer(m);
  }

  for (const chip of els.chips) chip.disabled = !counts[chip.dataset.type];
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

function placeHTML(p, hotel) {
  const type = TYPES[p.type] || TYPES.sight;
  return `
    ${photoHTML(p.photos)}
    <h2 class="place-title">${type.icon} ${esc(p.name)}</h2>
    ${p.name_local ? `<p class="place-local" lang="${p.city === 'paris' ? 'fr' : 'cs'}">${esc(p.name_local)}</p>` : ''}
    <div class="place-meta">
      <span class="badge">${type.label}</span>
      ${p.verified ? '' : '<span class="badge warn">⚠️ не проверено</span>'}
    </div>
    ${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}
    <h3>Нагрузка</h3>
    ${effortHTML(p.effort)}
    ${transitHTML(p.transit_hint)}
    <div class="route-btns">
      <a class="btn" href="${gmapsRoute(hotel.coords, p.coords)}" target="_blank" rel="noopener">🧭 Маршрут от отеля</a>
      <a class="btn secondary" href="${gmapsRoute(p.coords, hotel.coords)}" target="_blank" rel="noopener">🏨 Маршрут в отель</a>
    </div>
    <h3>Часы работы</h3>
    ${hoursHTML(p.hours)}
    <h3>Цены</h3>
    ${priceHTML(p.price, p.booking)}
    ${p.address ? `<p class="muted">📍 ${esc(p.address)}</p>` : ''}
    ${p.game_id ? `<a class="btn game-link" href="#/game/${encodeURIComponent(p.game_id)}">🎲 Играть</a>` : ''}`;
}

function openPlace(p) {
  const city = currentCity;
  openSheet(placeHTML(p, currentHotel), {
    // Убираем place из адреса, только если адрес всё ещё указывает на эту точку.
    onClose: () => {
      const q = new URLSearchParams(location.hash.split('?')[1] || '');
      if (location.hash.startsWith('#/map') && q.get('city') === city && q.get('place') === p.id) setHash(city);
    },
  });
}

function openHotel() {
  const h = currentHotel;
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

  if (query.place) {
    const p = currentPlaces.find((x) => x.id === query.place);
    if (p) {
      if (hiddenTypes.has(p.type)) toggleType(p.type, true);
      focusOn(p.coords);
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
