// План по дням: заглушка, лента появится в следующем коммите.
import { esc } from './ui.js';

export function renderList() {
  return `<h1>План</h1><div class="card stub"><p>📅 Лента дней — скоро.</p></div>`;
}

export function renderDay({ param }) {
  return `<a class="back" href="#/plan">← Все дни</a><h1>${esc(param)}</h1>
    <div class="card stub"><p>📅 Скоро.</p></div>`;
}

export function afterList() {}
