// Офлайн-кэш: оболочка — stale-while-revalidate, data/*.json — network-first с откатом в кэш.
// Тайлы карты не кэшируются. При изменении списка файлов поднять версию.
const VERSION = 'v27';
const CACHE = `trip2026-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/app.js', 'js/data.js', 'js/days.js', 'js/energy.js', 'js/facts.js', 'js/games.js', 'js/game-photo.js', 'js/game-rating.js', 'js/map.js',
  'js/picker.js', 'js/plan.js', 'js/players.js', 'js/practical.js', 'js/recs.js', 'js/sheet.js', 'js/store.js', 'js/theme.js', 'js/top8.js', 'js/ui.js',
  'data/hotels.json', 'data/places-prague.json', 'data/places-paris.json',
  'data/days.json', 'data/practical.json', 'data/fun-facts.json',
  'data/games/index.json',
  'data/games/photo-assignment.json',
  'data/games/gothic-photo-quest.json',
  'data/games/patisserie-tasting.json',
  'data/games/czech-pub-evening.json',
  'data/games/chateau-vincennes.json',
  'data/games/palais-porte-doree.json',
  'data/games/orangerie.json',
  'data/games/marais.json',
  'data/games/eiffel-tower.json',
  'data/games/sainte-chapelle.json',
  'data/games/novy-svet.json',
  'data/games/loreta.json',
  'data/games/st-nicholas-mala-strana.json',
  'data/games/josefov.json',
  'data/games/municipal-house.json',
  'data/games/strahov-library.json',
  'data/games/sacre-coeur.json',
  'data/games/notre-dame.json',
  'data/games/orsay.json',
  'data/games/louvre.json',
  'data/games/versailles.json', 'data/games/charles-bridge.json', 'data/games/prague-castle.json', 'data/games/old-town-square.json', 'data/games/vysehrad.json',
];
// Шрифт заголовков эмо-темы: кэшируется при первом использовании. Офлайн без него — системный.
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Leaflet с CDN — по возможности: без него офлайн не откроется только карта.
    await Promise.all(CDN.map((url) => cache.add(new Request(url, { mode: 'cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('trip2026-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(event.request, { ignoreSearch: true });
  const update = fetch(event.request).then((response) => {
    if (response.ok) cache.put(event.request, response.clone());
    return response;
  });
  if (cached) {
    event.waitUntil(update.catch(() => {}));
    return cached;
  }
  return update;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
      event.respondWith(networkFirst(request));
    } else if (request.mode === 'navigate') {
      // Любая навигация внутри сайта — это index.html (роутинг на hash).
      event.respondWith(networkFirst(request).catch(() => caches.match('index.html')));
    } else {
      event.respondWith(staleWhileRevalidate(event));
    }
  } else if (CDN.includes(request.url) || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event));
  }
  // Остальное (тайлы OSM, Wikimedia, внешние ссылки) — напрямую в сеть.
});
