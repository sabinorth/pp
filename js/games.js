// Игры: заглушка до этапа 4.
import { esc } from './ui.js';

export function render() {
  return `<h1>Игры</h1>
    <div class="card stub"><p>🎲 Игры появятся на этапе 4.</p></div>`;
}

export function renderGame({ param }) {
  return `<a class="back" href="#/games">← Все игры</a>
    <h1>Игра «${esc(param)}»</h1>
    <div class="card stub"><p>🎲 Скоро. Игры появятся на этапе 4.</p></div>`;
}
