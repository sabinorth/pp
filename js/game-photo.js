// Мини-игра «Фото-задание»: темы, таймер, отметка «снято» у каждой, вечерний выбор кадров.
// Данные: data/games/<id>.json с meta.kind = "photo", topics[], timer_min[], pick_count.
// Состояние: { started_at, timer_min, shot: { [тема]: [индексы игроков] }, picks: [[{ topic, caption, shown }]] }
import { esc } from './ui.js';

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const hours = (min) => `${String(min / 60).replace('.', ',')} ч`;

function picksOf(state, game, pi) {
  const list = state.picks?.[pi] || [];
  return Array.from({ length: game.pick_count }, (_, k) => list[k] || { topic: '', caption: '', shown: false });
}

const filled = (p) => p.topic !== '' || p.caption.trim() !== '';

function timerHTML(game, state) {
  if (!state.started_at) {
    return `<section class="card">
      <h2>⏱️ Таймер</h2>
      <p class="muted">Запустите, когда разойдётесь снимать.</p>
      <div class="timer-btns">${game.timer_min.map((min) => `<button type="button" class="btn" data-timer="${min}">▶️ ${hours(min)}</button>`).join('')}</div>
    </section>`;
  }
  const end = state.started_at + state.timer_min * 60000;
  return `<section class="card">
    <h2>⏱️ Таймер · ${hours(state.timer_min)}</h2>
    <p class="timer" data-end="${end}" aria-live="off">${fmt(Math.max(end - Date.now(), 0))}</p>
    <button type="button" class="btn secondary wide" data-timer-reset>↺ Сбросить таймер</button>
  </section>`;
}

function topicsHTML(game, state, players) {
  const shot = state.shot || {};
  const counts = players.map((name, pi) => `${esc(name)}: ${game.topics.filter((_, ti) => shot[ti]?.includes(pi)).length} из ${game.topics.length}`);
  return `<section class="card">
    <h2>📷 Темы</h2>
    <p class="muted">Снято — ${counts.join(' · ')}</p>
    ${game.topics.map((t, ti) => `
      <div class="topic">
        <p class="topic-name"><strong>${ti + 1}.</strong> ${esc(t)}</p>
        <div class="topic-players">${players.map((name, pi) => {
          const on = !!shot[ti]?.includes(pi);
          return `<button type="button" class="chip shot" data-shot="${ti}" data-p="${pi}" aria-pressed="${on}">${on ? '✅' : '⬜'} ${esc(name)}</button>`;
        }).join('')}</div>
      </div>`).join('')}
  </section>`;
}

function picksHTML(game, state, players) {
  return `<section class="card">
    <h2>🌙 Вечер: по ${game.pick_count} кадров</h2>
    <p class="muted">Каждая выбирает в галерее лучшие кадры и записывает сюда тему и номер кадра. ✓ — уже показала.</p>
    ${players.map((name, pi) => {
      const picks = picksOf(state, game, pi);
      return `<h3 class="pick-head"><span>${esc(name)}</span> <span class="badge" data-pick-count="${pi}">${picks.filter(filled).length}/${game.pick_count}</span></h3>
      ${picks.map((p, k) => `
        <div class="pick-row" data-p="${pi}" data-k="${k}">
          <span class="pick-num">${k + 1}</span>
          <select data-pick="topic" aria-label="${esc(name)}, кадр ${k + 1}: тема">
            <option value="">— тема —</option>
            ${game.topics.map((t, ti) => `<option value="${ti}" ${String(p.topic) === String(ti) ? 'selected' : ''}>${esc(t)}</option>`).join('')}
          </select>
          <input type="text" data-pick="caption" value="${esc(p.caption)}" maxlength="60" placeholder="Номер кадра или что на нём" aria-label="${esc(name)}, кадр ${k + 1}: подпись">
          <button type="button" class="icon-btn" data-pick="shown" aria-pressed="${!!p.shown}" aria-label="Показала">${p.shown ? '✅' : '✓'}</button>
        </div>`).join('')}`;
    }).join('')}
  </section>`;
}

export function html(game, state, players) {
  return `${timerHTML(game, state)}${topicsHTML(game, state, players)}${picksHTML(game, state, players)}`;
}

// Обратный отсчёт; интервал сам останавливается, когда таймер пропал со страницы.
function startTick(body) {
  const t = body.querySelector('[data-end]');
  if (!t) return;
  const update = () => {
    if (!t.isConnected) { clearInterval(iv); return; }
    const left = Number(t.dataset.end) - Date.now();
    if (left > 0) {
      t.textContent = fmt(left);
    } else {
      t.textContent = '⏰ Время вышло';
      t.classList.add('done');
      clearInterval(iv);
    }
  };
  const iv = setInterval(update, 1000);
  update();
}

export function bind(body, game, ctx) {
  const refresh = () => { ctx.refresh(); startTick(body); };
  startTick(body);

  const setPick = (row, patch, rerender) => {
    const state = ctx.state();
    const pi = Number(row.dataset.p);
    const picks = picksOf(state, game, pi);
    picks[Number(row.dataset.k)] = { ...picks[Number(row.dataset.k)], ...patch };
    const all = [...(state.picks || [])];
    all[pi] = picks;
    ctx.save({ ...state, picks: all });
    if (rerender) refresh();
    else body.querySelector(`[data-pick-count="${pi}"]`).textContent = `${picks.filter(filled).length}/${game.pick_count}`;
  };

  body.addEventListener('click', (e) => {
    const state = ctx.state();
    const timer = e.target.closest('[data-timer]');
    if (timer) {
      ctx.save({ ...state, started_at: Date.now(), timer_min: Number(timer.dataset.timer) });
      refresh();
      return;
    }
    if (e.target.closest('[data-timer-reset]')) {
      if (!confirm('Сбросить таймер?')) return;
      ctx.save({ ...state, started_at: null, timer_min: null });
      refresh();
      return;
    }
    const b = e.target.closest('[data-shot]');
    if (b) {
      const ti = b.dataset.shot;
      const pi = Number(b.dataset.p);
      const cur = state.shot?.[ti] || [];
      const next = cur.includes(pi) ? cur.filter((x) => x !== pi) : [...cur, pi];
      ctx.save({ ...state, shot: { ...state.shot, [ti]: next } });
      refresh();
      return;
    }
    const shown = e.target.closest('[data-pick="shown"]');
    if (shown) setPick(shown.closest('.pick-row'), { shown: shown.getAttribute('aria-pressed') !== 'true' }, true);
  });

  body.addEventListener('change', (e) => {
    if (e.target.dataset.pick === 'topic') setPick(e.target.closest('.pick-row'), { topic: e.target.value }, false);
  });
  body.addEventListener('input', (e) => {
    if (e.target.dataset.pick === 'caption') setPick(e.target.closest('.pick-row'), { caption: e.target.value }, false);
  });
}
