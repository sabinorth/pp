// Загрузка JSON из data/ с кэшем в памяти.
const cache = new Map();

export function loadJSON(name) {
  if (!cache.has(name)) {
    const p = fetch(`data/${name}`).then((r) => {
      if (!r.ok) throw new Error(`Не удалось загрузить data/${name} (HTTP ${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name);
}

export const CITIES = {
  prague: { name: 'Прага', flag: '🇨🇿' },
  paris: { name: 'Париж', flag: '🇫🇷' },
};

export async function getHotel(city) {
  const hotels = await loadJSON('hotels.json');
  return hotels.find((h) => h.city === city);
}

export function getPlaces(city) {
  return loadJSON(`places-${city}.json`);
}

export async function getPlace(city, id) {
  const places = await getPlaces(city);
  return places.find((p) => p.id === id);
}

export function getDays() {
  return loadJSON('days.json');
}

// Игры: index.json — список готовых, остальные game_id из мест показываются как «скоро».
export async function getGameIds() {
  try {
    return await loadJSON('games/index.json');
  } catch {
    return [];
  }
}

export function getGame(id) {
  return loadJSON(`games/${id}.json`);
}
