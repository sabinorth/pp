// Имена игроков (задаются в «Играх»). Нужны и играм, и шапкам «<Имя>'s …» в эмо-теме.
import { get } from './store.js';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export function getPlayers() {
  const p = get('games.players', null);
  if (Array.isArray(p) && p.length >= MIN_PLAYERS) return p.slice(0, MAX_PLAYERS);
  return ['Игрок 1', 'Игрок 2'];
}

export function playerName(players, i) {
  return players[i % players.length]?.trim() || `Игрок ${(i % players.length) + 1}`;
}

// «Игрок 1 & Игрок 2» — для общих блоков.
export function crewName(players = getPlayers()) {
  return players.map((_, i) => playerName(players, i)).join(' & ');
}
