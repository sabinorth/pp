// Игры: кооперативные истории по местам, квиз и задания «на месте».
// Схема: #/games, #/game/charles-bridge, #/game/charles-bridge?screen=quiz|onsite
// Мини-игры (meta.kind) рисуют свои модули: #/game/photo-assignment
import { CITIES, getGameIds, getGame, getPlace } from './data.js';
import { get, set } from './store.js';
import { esc } from './ui.js';
import * as photo from './game-photo.js';
import * as rating from './game-rating.js';

const MINI = { photo, rating };

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

// ---------- состояние в localStorage (store.js сам ловит ошибки хранилища) ----------

function getPlayers() {
  const p = get('games.players', null);
  if (Array.isArray(p) && p.length >= MIN_PLAYERS) return p.slice(0, MAX_PLAYERS);
  return ['Игрок 1', 'Игрок 2'];
}

function playerName(players, i) {
  return players[i % players.length]?.trim() || `Игрок ${(i % players.length) + 1}`;
}

function getProgress(id) {
  return get('games.progress', {})[id] || null;
}

function setProgress(id, value) {
  const all = { ...get('games.progress', {}) };
  if (value) all[id] = value;
  else delete all[id];
  set('games.progress', all);
}

function getDone(id) {
  return get('games.done', {})[id] || null;
}

function setDone(id, patch) {
  const all = { ...get('games.done', {}) };
  all[id] = { ...all[id], ...patch };
  set('games.done', all);
}

// ---------- граф сцен ----------

function sceneMap(game) {
  return Object.fromEntries(game.scenes.map((s) => [s.id, s]));
}

// Глубина сцены от старта (для прогресс-бара): ветки сходятся, поэтому достаточно BFS.
function depths(game) {
  const scenes = sceneMap(game);
  const d = { [game.meta.start]: 0 };
  const queue = [game.meta.start];
  while (queue.length) {
    const id = queue.shift();
    for (const c of scenes[id]?.choices || []) {
      if (d[c.next] === undefined) {
        d[c.next] = d[id] + 1;
        queue.push(c.next);
      }
    }
  }
  return { d, max: Math.max(...Object.values(d)) };
}

const mapLink = (m) => `#/map?city=${encodeURIComponent(m.city)}&place=${encodeURIComponent(m.place_id)}`;
const gameLink = (id, screen) => `#/game/${encodeURIComponent(id)}${screen ? `?screen=${screen}` : ''}`;

// ---------- список игр ----------

function playersHTML(players) {
  const inputs = players.map((name, i) => `
    <label class="player">
      <span class="player-num">${i + 1}</span>
      <input type="text" name="player" data-i="${i}" value="${esc(name)}" maxlength="20" autocomplete="off" aria-label="Имя игрока ${i + 1}">
    </label>`).join('');
  return `<section class="card players">
    <h2>Игроки</h2>
    <p class="muted">Ход переходит по кругу: каждую сцену выбирает следующий игрок.</p>
    ${inputs}
    <div class="players-btns">
      <button type="button" class="btn secondary" data-players="-1" ${players.length <= MIN_PLAYERS ? 'disabled' : ''}>− Игрок</button>
      <button type="button" class="btn secondary" data-players="1" ${players.length >= MAX_PLAYERS ? 'disabled' : ''}>+ Игрок</button>
    </div>
  </section>`;
}

function gameCardHTML(game, place) {
  const m = game.meta;
  const done = getDone(m.id);
  const prog = getProgress(m.id);
  let status = '';
  if (done?.achievement) status = `<span class="badge ok">${esc(game.achievement.emoji)} ${esc(game.achievement.title)}</span>`;
  else if (prog) status = '<span class="badge">▶️ Начата</span>';
  const quiz = done?.quiz != null ? `<span class="badge">Квиз: ${done.quiz}/${game.quiz.length}</span>` : '';
  return `<a class="card game-card" href="${gameLink(m.id)}">
    <h3>${esc(m.title)}</h3>
    <p class="muted">${esc(place?.name || '')} · ≈${m.duration_min} мин</p>
    ${status || quiz ? `<div class="place-meta">${status}${quiz}</div>` : ''}
  </a>`;
}

export async function render() {
  const ids = await getGameIds();
  const games = await Promise.all(ids.map((id) => getGame(id).catch(() => null)));
  const ready = games.filter(Boolean);
  const places = await Promise.all(ready.map((g) => getPlace(g.meta.city, g.meta.place_id)));

  const achieved = ready.filter((g) => getDone(g.meta.id)?.achievement);
  const achHTML = achieved.length
    ? `<section class="card"><h2>Достижения</h2><p class="ach-list">${achieved.map((g) => `<span class="badge ok">${esc(g.achievement.emoji)} ${esc(g.achievement.title)}</span>`).join(' ')}</p></section>`
    : '';

  const groups = Object.entries(CITIES).map(([city, c]) => {
    const list = ready.map((g, i) => [g, places[i]]).filter(([g]) => g.meta.city === city);
    if (!list.length) return '';
    return `<h2>${c.flag} ${c.name}</h2>${list.map(([g, p]) => gameCardHTML(g, p)).join('')}`;
  }).join('');

  return `<h1>Игры</h1>
    <p class="muted">Короткие истории по местам: минут пять вместе — и на месте интереснее.</p>
    ${playersHTML(getPlayers())}
    ${achHTML}
    ${groups || '<div class="card stub"><p>Игр пока нет.</p></div>'}`;
}

export function after(el) {
  const box = el.querySelector('.players');
  if (!box) return;
  box.addEventListener('input', (e) => {
    const inp = e.target.closest('input[name="player"]');
    if (!inp) return;
    const players = getPlayers();
    players[Number(inp.dataset.i)] = inp.value;
    set('games.players', players);
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-players]');
    if (!b) return;
    const players = getPlayers();
    if (b.dataset.players === '1' && players.length < MAX_PLAYERS) players.push(`Игрок ${players.length + 1}`);
    if (b.dataset.players === '-1' && players.length > MIN_PLAYERS) players.pop();
    set('games.players', players);
    box.outerHTML = playersHTML(players);
    after(el);
  });
}

// ---------- экран игры ----------

function sceneHTML(game, prog) {
  const scenes = sceneMap(game);
  const scene = scenes[prog.scene] || scenes[game.meta.start];
  const { d, max } = depths(game);
  const pct = Math.round(((d[scene.id] ?? 0) / max) * 100);
  const players = getPlayers();
  const lines = (scene.lines || []).filter((l) => prog.flags.includes(l.if));
  const isEnd = !scene.choices.length;

  const choices = isEnd
    ? `<div class="game-end">
        <p class="achievement">${esc(game.achievement.emoji)} <strong>${esc(game.achievement.title)}</strong><br><span class="muted">Достижение получено</span></p>
        <a class="btn wide" href="${gameLink(game.meta.id, 'quiz')}">❓ Квиз по истории</a>
        <a class="btn wide secondary" href="${gameLink(game.meta.id, 'onsite')}">📍 Задания на месте</a>
      </div>`
    : `<p class="turn">Выбирает: <strong>${esc(playerName(players, prog.step))}</strong></p>
       <div class="choices">${scene.choices.map((c, i) => `<button type="button" class="btn choice" data-choice="${i}">${esc(c.text)}</button>`).join('')}</div>`;

  return `
    <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Прогресс истории"><span style="width:${pct}%"></span></div>
    <article class="card scene">
      <h2>${esc(scene.title)}</h2>
      ${scene.speaker ? `<p class="speaker">🗣️ ${esc(scene.speaker)}</p>` : ''}
      ${scene.text.map((t) => `<p>${esc(t)}</p>`).join('')}
      ${lines.map((l) => `<p class="line">${esc(l.text)}</p>`).join('')}
    </article>
    ${choices}`;
}

function quizHTML(game) {
  const players = getPlayers();
  return `<h2>Квиз</h2>
    ${game.quiz.map((q, qi) => `
      <section class="card quiz-q" data-q="${qi}">
        <p class="turn">Отвечает: <strong>${esc(playerName(players, qi))}</strong></p>
        <h3>${esc(q.q)}</h3>
        <div class="choices">${q.options.map((o, oi) => `<button type="button" class="btn secondary quiz-opt" data-opt="${oi}">${esc(o)}</button>`).join('')}</div>
        <p class="explain" hidden></p>
      </section>`).join('')}
    <p class="quiz-result card" hidden></p>`;
}

function onsiteHTML(game) {
  return `<h2>Задания на месте</h2>
    <p class="muted">Для прогулки по мосту: найдите и проверьте себя.</p>
    ${game.onsite.map((o, i) => `
      <section class="card onsite">
        <p><strong>${i + 1}.</strong> ${esc(o.task)}</p>
        <details><summary>Показать разгадку</summary><p>${esc(o.answer)}</p></details>
      </section>`).join('')}`;
}

function sourcesHTML(meta) {
  if (!meta.sources?.length) return '';
  return `<details class="card sources"><summary>Источники</summary>
    <ul class="link-list">${meta.sources.map((s) => `<li><a href="${esc(s)}" target="_blank" rel="noopener">${esc(decodeURI(s).replace(/^https?:\/\//, ''))}</a></li>`).join('')}</ul>
  </details>`;
}

export async function renderGame({ param, query }) {
  const ids = await getGameIds();
  if (!ids.includes(param)) {
    return `<a class="back" href="#/games">← Все игры</a>
      <div class="card stub"><p>🎲 Эта игра ещё пишется. Скоро будет.</p></div>`;
  }
  const game = await getGame(param);
  const m = game.meta;
  const mini = MINI[m.kind];
  const screen = mini ? undefined : query.screen;
  const prog = getProgress(m.id) || { scene: m.start, flags: [], step: 0 };

  let body;
  if (mini) body = mini.html(game, getProgress(m.id) || {}, getPlayers());
  else if (screen === 'quiz') body = quizHTML(game);
  else if (screen === 'onsite') body = onsiteHTML(game);
  else body = sceneHTML(game, prog);

  const tabs = `<nav class="game-tabs" aria-label="Разделы игры">
    <a class="chip" href="${gameLink(m.id)}" ${!screen ? 'aria-current="page"' : ''}>📖 История</a>
    <a class="chip" href="${gameLink(m.id, 'quiz')}" ${screen === 'quiz' ? 'aria-current="page"' : ''}>❓ Квиз</a>
    <a class="chip" href="${gameLink(m.id, 'onsite')}" ${screen === 'onsite' ? 'aria-current="page"' : ''}>📍 На месте</a>
  </nav>`;

  return `<a class="back" href="#/games">← Все игры</a>
    <div class="game" data-id="${esc(m.id)}" ${mini ? `data-kind="${esc(m.kind)}"` : ''}>
      <h1>${esc(m.title)}</h1>
      ${mini ? `<p class="muted">${esc(m.subtitle)}</p>` : tabs}
      <div class="game-body">${body}</div>
      <div class="game-foot">
        <a class="btn secondary" href="${mapLink(m)}">🗺️ Показать на карте</a>
        ${!screen ? '<button type="button" class="btn secondary" data-restart>↺ Начать заново</button>' : ''}
      </div>
      ${sourcesHTML(m)}
    </div>`;
}

export function afterGame(el, r) {
  const root = el.querySelector('.game');
  if (!root) return;
  const id = root.dataset.id;
  const mini = MINI[root.dataset.kind];

  // Мини-игра обновляет только своё тело, без прокрутки.
  if (mini) {
    const body = root.querySelector('.game-body');
    getGame(id).then((game) => {
      const players = getPlayers();
      mini.bind(body, game, {
        state: () => getProgress(id) || {},
        save: (s) => setProgress(id, s),
        refresh: () => { body.innerHTML = mini.html(game, getProgress(id) || {}, players); },
        players,
      });
    });
  }

  const rerender = async () => {
    el.innerHTML = await renderGame(r);
    afterGame(el, r);
    el.querySelector('.game-body')?.scrollIntoView({ block: 'start' });
  };

  root.addEventListener('click', async (e) => {
    const choice = e.target.closest('[data-choice]');
    if (choice) {
      const game = await getGame(id);
      const prog = getProgress(id) || { scene: game.meta.start, flags: [], step: 0 };
      const scene = sceneMap(game)[prog.scene] || sceneMap(game)[game.meta.start];
      const c = scene.choices[Number(choice.dataset.choice)];
      const next = sceneMap(game)[c.next];
      setProgress(id, {
        scene: c.next,
        flags: [...new Set([...prog.flags, ...(c.set || [])])],
        step: prog.step + 1,
      });
      if (next && !next.choices.length) setDone(id, { achievement: true });
      await rerender();
      return;
    }

    if (e.target.closest('[data-restart]')) {
      if (mini && !confirm('Стереть все отметки и начать заново?')) return;
      setProgress(id, null);
      await rerender();
      return;
    }

    const opt = e.target.closest('.quiz-opt');
    if (opt) {
      const game = await getGame(id);
      const sec = opt.closest('.quiz-q');
      if (sec.dataset.answered) return;
      const q = game.quiz[Number(sec.dataset.q)];
      const picked = Number(opt.dataset.opt);
      sec.dataset.answered = picked === q.answer ? 'ok' : 'no';
      sec.querySelectorAll('.quiz-opt').forEach((b, i) => {
        b.disabled = true;
        if (i === q.answer) b.classList.add('right');
        else if (i === picked) b.classList.add('wrong');
      });
      const ex = sec.querySelector('.explain');
      ex.textContent = `${picked === q.answer ? '✅ Верно!' : '❌ Мимо.'} ${q.explain}`;
      ex.hidden = false;

      const all = root.querySelectorAll('.quiz-q');
      const answered = [...all].filter((s) => s.dataset.answered);
      if (answered.length === all.length) {
        const score = answered.filter((s) => s.dataset.answered === 'ok').length;
        setDone(id, { quiz: Math.max(score, getDone(id)?.quiz ?? 0) });
        const res = root.querySelector('.quiz-result');
        res.textContent = `Итог: ${score} из ${all.length}. ${score === all.length ? 'Мост вами гордится.' : 'Остальное расскажет сам мост.'}`;
        res.hidden = false;
      }
    }
  });
}
