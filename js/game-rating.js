// Мини-игра «Оценки игроков по N слотам»: слепая дегустация, сравнение наливов.
// Данные: data/games/<id>.json с meta.kind = "rating", slots[], scale, blind, reveal_label.
// Состояние: { current, scores: { [слот]: { [игрок]: оценка } }, revealed, names: { [слот]: текст } }
import { esc } from './ui.js';

const scoreOf = (state, slotId, pi) => state.scores?.[slotId]?.[pi];
const ratedCount = (game, state, pi) => game.slots.filter((s) => scoreOf(state, s.id, pi) != null).length;

function rateHTML(game, state, players) {
  const cur = Math.min(state.current || 0, players.length - 1);
  const status = players.map((name, pi) => `<span class="badge ${ratedCount(game, state, pi) === game.slots.length ? 'ok' : ''}">${esc(name)}: ${ratedCount(game, state, pi)} из ${game.slots.length}</span>`).join(' ');
  return `<section class="card">
      <h2>Сейчас оценивает</h2>
      <div class="rate-who">${players.map((name, pi) => `<button type="button" class="chip who" data-who="${pi}" aria-pressed="${pi === cur}">${esc(name)}</button>`).join('')}</div>
      <p class="muted">${game.blind ? 'Чужие оценки скрыты до итогов. Оценили — передайте телефон.' : 'Оценки остальных видны в итогах.'}</p>
      <p class="rate-status">${status}</p>
    </section>
    ${game.slots.map((s) => `
      <section class="card rate-slot">
        <h3>${esc(s.name)}</h3>
        <div class="score-btns" role="group" aria-label="${esc(s.name)}: оценка ${esc(players[cur])}">
          ${Array.from({ length: game.scale }, (_, i) => i + 1).map((n) => `<button type="button" class="btn secondary score" data-slot="${esc(s.id)}" data-score="${n}" aria-pressed="${scoreOf(state, s.id, cur) === n}">${n}</button>`).join('')}
        </div>
      </section>`).join('')}
    <button type="button" class="btn wide" data-reveal>🏁 Показать итоги</button>`;
}

function resultsHTML(game, state, players) {
  const total = (s) => players.reduce((sum, _, pi) => sum + (scoreOf(state, s.id, pi) || 0), 0);
  const best = Math.max(...game.slots.map(total));
  const winners = best > 0 ? game.slots.filter((s) => total(s) === best) : [];
  const label = (s) => (state.names?.[s.id]?.trim() ? `${s.name} — ${state.names[s.id].trim()}` : s.name);
  const verdict = winners.length === 1
    ? `🏆 Победитель: <strong>${esc(label(winners[0]))}</strong>`
    : winners.length ? `🤝 Ничья: ${winners.map((s) => `<strong>${esc(label(s))}</strong>`).join(', ')}` : 'Оценок пока нет.';

  return `<section class="card">
      <h2>Итоги</h2>
      <p class="verdict">${verdict}</p>
      <div class="table-wrap"><table class="results">
        <thead><tr><th scope="col"></th>${players.map((name) => `<th scope="col">${esc(name)}</th>`).join('')}<th scope="col">Сумма</th></tr></thead>
        <tbody>${game.slots.map((s) => `<tr class="${winners.includes(s) ? 'win' : ''}">
          <th scope="row">${esc(s.name)}</th>
          ${players.map((_, pi) => `<td>${scoreOf(state, s.id, pi) ?? '—'}</td>`).join('')}
          <td><strong>${total(s)}</strong></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </section>
    ${game.blind ? `<section class="card">
      <h2>Раскрываем</h2>
      ${game.slots.map((s) => `<label class="field reveal">${esc(s.name)}
        <input type="text" data-name="${esc(s.id)}" value="${esc(state.names?.[s.id] || '')}" maxlength="60" placeholder="${esc(game.reveal_label || 'Что это было')}">
      </label>`).join('')}
    </section>` : ''}
    <button type="button" class="btn secondary wide" data-unreveal>✏️ Вернуться к оценкам</button>`;
}

export function html(game, state, players) {
  return state.revealed ? resultsHTML(game, state, players) : rateHTML(game, state, players);
}

export function bind(body, game, ctx) {
  body.addEventListener('click', (e) => {
    const state = ctx.state();
    const who = e.target.closest('[data-who]');
    const score = e.target.closest('[data-score]');
    if (who) {
      ctx.save({ ...state, current: Number(who.dataset.who) });
    } else if (score) {
      const pi = Math.min(state.current || 0, ctx.players.length - 1);
      const slot = score.dataset.slot;
      ctx.save({ ...state, scores: { ...state.scores, [slot]: { ...state.scores?.[slot], [pi]: Number(score.dataset.score) } } });
    } else if (e.target.closest('[data-reveal]')) {
      const full = ctx.players.every((_, pi) => ratedCount(game, state, pi) === game.slots.length);
      if (!full && !confirm('Оценили ещё не всё. Всё равно показать итоги?')) return;
      ctx.save({ ...state, revealed: true });
    } else if (e.target.closest('[data-unreveal]')) {
      ctx.save({ ...state, revealed: false });
    } else {
      return;
    }
    ctx.refresh();
  });

  body.addEventListener('input', (e) => {
    const slot = e.target.dataset.name;
    if (slot == null) return;
    const state = ctx.state();
    ctx.save({ ...state, names: { ...state.names, [slot]: e.target.value } });
  });
}
