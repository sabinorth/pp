// Оболочка приложения и hash-роутер.
// Схема: #/plan, #/day/2026-10-08, #/map?city=paris&place=louvre, #/recs, #/games, #/game/versailles
import * as days from './days.js';
import * as mapView from './map.js';
import * as recs from './recs.js';
import * as games from './games.js';
import { closeSheet } from './sheet.js';
import { esc } from './ui.js';

const ROUTES = {
  plan:  { tab: 'plan',  render: days.renderList, after: days.afterList },
  day:   { tab: 'plan',  render: days.renderDay },
  map:   { tab: 'map',   map: true },
  recs:  { tab: 'recs',  render: recs.render },
  games: { tab: 'games', render: games.render },
  game:  { tab: 'games', render: games.renderGame },
};

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const qIndex = raw.indexOf('?');
  const path = qIndex === -1 ? raw : raw.slice(0, qIndex);
  const qs = qIndex === -1 ? '' : raw.slice(qIndex + 1);
  const [route, ...rest] = path.split('/').filter(Boolean);
  return {
    route: route || 'plan',
    param: rest.length ? decodeURIComponent(rest.join('/')) : null,
    query: Object.fromEntries(new URLSearchParams(qs)),
  };
}

const viewEl = document.getElementById('view');
const mapEl = document.getElementById('map-view');
let renderToken = 0;

async function onRoute() {
  const r = parseHash();
  const def = ROUTES[r.route];
  if (!def) {
    location.replace('#/plan');
    return;
  }

  for (const a of document.querySelectorAll('.tabbar a')) {
    const active = a.dataset.tab === def.tab;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  const token = ++renderToken;
  try {
    if (def.map) {
      viewEl.hidden = true;
      mapEl.hidden = false;
      await mapView.show(mapEl, r.query);
    } else {
      closeSheet();
      mapEl.hidden = true;
      viewEl.hidden = false;
      viewEl.innerHTML = '<p class="muted">Загрузка…</p>';
      const html = await def.render(r);
      if (token !== renderToken) return;
      viewEl.innerHTML = html;
      window.scrollTo(0, 0);
      def.after?.(viewEl, r);
    }
  } catch (err) {
    console.error(err);
    if (token !== renderToken) return;
    mapEl.hidden = true;
    viewEl.hidden = false;
    viewEl.innerHTML = `<div class="card error"><h2>Не получилось загрузить</h2><p>${esc(err.message)}</p>
      <p class="muted">Сайт нужно открывать через локальный сервер, а не как файл.</p></div>`;
  }
}

window.addEventListener('hashchange', onRoute);
onRoute();
