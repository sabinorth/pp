// «Практическое» внутри «Советов»: транспорт, погода, фразы, экстренные номера, аптеки, настройки.
import { CITIES, loadJSON } from './data.js';
import { esc, fmtDate } from './ui.js';
import * as plan from './plan.js';
import * as energy from './energy.js';
import * as theme from './theme.js';

const ext = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>`;
const cityHead = (city) => `${CITIES[city].flag} ${CITIES[city].name}`;

function sourcesHTML(list) {
  const urls = (Array.isArray(list) ? list : [list]).filter(Boolean);
  if (!urls.length) return '';
  return `<p class="muted src">Источники: ${urls.map((u, i) => ext(u, String(i + 1))).join(', ')}</p>`;
}

function linksHTML(links) {
  if (!links?.length) return '';
  return `<ul class="link-list">${links.map((l) => `<li>${ext(l.url, l.name)} ↗</li>`).join('')}</ul>`;
}

function section(id, title, body, open = false) {
  return `<details class="card prac" id="${id}"${open ? ' open' : ''}><summary><h2>${title}</h2></summary>${body}</details>`;
}

function transportHTML(list) {
  return list.map((t) => `<h3>${cityHead(t.city)}</h3>
    <ul>${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    ${linksHTML(t.apps)}${sourcesHTML(t.sources)}`).join('');
}

function weatherHTML(list) {
  return `<p class="muted">Прогноз по ссылке — он всегда свежий.</p>`
    + list.map((w) => `<h3>${cityHead(w.city)}</h3>${linksHTML(w.links)}`).join('');
}

function phrasesHTML(list) {
  return list.map((g) => `<h3>${cityHead(g.city)} · ${esc(g.lang)}</h3>
    <ul class="phrases">${g.items.map((p) => `<li>
      <span class="ph-local" lang="${g.city === 'paris' ? 'fr' : 'cs'}">${esc(p.local)}</span>
      <span class="ph-tr">[${esc(p.tr)}]</span>
      <span class="ph-ru muted">${esc(p.ru)}</span></li>`).join('')}</ul>`).join('');
}

function emergencyHTML(list) {
  return list.map((e) => `<h3>${cityHead(e.city)}</h3>
    <ul class="numbers">${e.numbers.map((n) => `<li><a class="btn num" href="tel:${esc(n.num)}">📞 ${esc(n.num)}</a><span>${esc(n.what)}</span></li>`).join('')}</ul>
    ${sourcesHTML(e.source)}`).join('');
}

function pharmacyHTML(list) {
  return list.map((p) => {
    const map = p.address
      ? `<p>${ext(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`, '📍 Открыть адрес на карте')}</p>` : '';
    return `<h3>${cityHead(p.city)}</h3>
      <ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${map}${linksHTML(p.links)}${sourcesHTML(p.source)}`;
  }).join('');
}

function themeHTML() {
  const cur = theme.getTheme();
  const btns = Object.entries(theme.THEMES)
    .map(([id, t]) => `<button type="button" data-theme-set="${id}" aria-pressed="${id === cur}">${t.label}</button>`).join('');
  return `<div class="setting theme-setting"><span>Оформление</span><div class="seg">${btns}</div></div>`;
}

function settingsHTML() {
  const t = energy.getThreshold();
  return `${themeHTML()}
    <div class="setting">
      <span>Порог энергобюджета на день</span>
      <div class="stepper">
        <button type="button" class="icon-btn" data-step="-1" aria-label="Меньше">−</button>
        <output id="thr" aria-live="polite">${t}</output>
        <button type="button" class="icon-btn" data-step="1" aria-label="Больше">+</button>
      </div>
    </div>
    <p class="muted">По умолчанию ${energy.DEFAULT_THRESHOLD}. Лёгкое место = 1, среднее = 2, тяжёлое = 3, плюс 1 за каждые 3 км пешком. Кафе и отдых не считаются.</p>
    <button type="button" class="btn secondary wide" id="clear-mine">Сбросить ручной план во всех днях</button>
    <p class="muted" id="settings-msg" role="status"></p>`;
}

export async function render(focus) {
  const d = await loadJSON('practical.json');
  return `<p class="muted">Проверено ${fmtDate(d.checked_on)}.</p>
    ${section('transport', '🚇 Транспорт', transportHTML(d.transport), !focus)}
    ${section('weather', '🌦️ Погода', weatherHTML(d.weather))}
    ${section('phrases', '💬 Полезные фразы', phrasesHTML(d.phrases))}
    ${section('emergency', '🚑 Экстренные номера', emergencyHTML(d.emergency))}
    ${section('pharmacy', '💊 Дежурная аптека', pharmacyHTML(d.pharmacy))}
    ${section('settings', '⚙️ Настройки', settingsHTML(), focus === 'settings')}`;
}

export function after(el, focus) {
  const thr = el.querySelector('#thr');
  el.querySelector('#settings').addEventListener('click', (e) => {
    const th = e.target.closest('[data-theme-set]');
    if (th) {
      theme.setTheme(th.dataset.themeSet);
      for (const b of el.querySelectorAll('[data-theme-set]')) b.setAttribute('aria-pressed', b === th);
    }
    const step = e.target.closest('[data-step]');
    if (step) {
      const t = Math.min(energy.THRESHOLD_MAX, Math.max(energy.THRESHOLD_MIN, energy.getThreshold() + Number(step.dataset.step)));
      energy.setThreshold(t);
      thr.textContent = t;
    }
    if (e.target.closest('#clear-mine') && confirm('Удалить добавленные пункты, время и заметки и вернуть скрытые во всех днях?')) {
      plan.clearAll();
      el.querySelector('#settings-msg').textContent = 'Ручной план сброшен.';
    }
  });
  if (focus) el.querySelector(`#${CSS.escape(focus)}`)?.scrollIntoView({ block: 'start' });
}
