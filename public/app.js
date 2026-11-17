import { T } from './i18n.js';
import { UNITS, LEVELS, allItems } from './content.js';
import { freshState, merge, grade, pickCards, markTask, streak, today, question, unitStatus, PASS } from './store.js';
import { zh, zhShort, price, phone, pinyin, fmt } from './numbers.js';

// ---------- small helpers
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lsGet = k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
const lsSet = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} };
let LANG = lsGet('dc-lang') === 'zh' ? 'zh' : 'en';
const t = k => (T[k] ? T[k][LANG] : k);
const unitN = n => (LANG === 'zh' ? '第 ' + n + ' 课' : 'Unit ' + n);
const L = o => (o ? o[LANG] || o.en : '');

// ---------- state (this device). Settings that are per-device live outside S.
const KEY = 'dc-state';
let S = (() => { try { return merge(freshState(), JSON.parse(lsGet(KEY)) || {}); } catch { return freshState(); } })();
function save() { lsSet(KEY, JSON.stringify(S)); GH.dirty = true; queueSync(); }
const unitOf = id => UNITS.find(u => u.id === id);
const status = () => unitStatus(UNITS, LEVELS, S);
const openUnits = () => { const st = status(); return UNITS.filter(u => st[u.id].state === 'open'); };
// Current unit = the one picked in Settings if it is open, else the newest open unit.
const curUnit = () => { const o = openUnits(); return o.find(u => u.id === S.unit && S.unitT) || o[o.length - 1]; };

// ---------- voice (browser text-to-speech, zh-CN)
let RATE = +lsGet('dc-rate') || 0.8;
let VOICE = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  VOICE = vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, slow) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-CN'; if (VOICE) u.voice = VOICE; u.rate = slow ? Math.max(0.4, RATE - 0.3) : RATE;
  speechSynthesis.speak(u);
}
document.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) { e.stopPropagation(); say(b.dataset.say, b.dataset.slow); } });

// ---------- routing
const TABS = [['today', '☀️', 'tabToday'], ['learn', '📘', 'tabLearn'], ['practice', '🎯', 'tabPractice'], ['teach', '📋', 'tabTeach'], ['settings', '⚙️', 'tabSettings']];
// Navigation: tabs are roots; open() goes one screen deeper and remembers where we were (also in browser history,
// so the phone's back gesture works); back() returns there, at the same scroll position.
let R = { tab: lsGet('dc-tab') || 'today', sub: null };
let STACK = [], UNWIND = 0;
history.replaceState({ dc: 0 }, '');
function show(r, y = 0) { R = r; lsSet('dc-tab', r.tab); render(); window.scrollTo(0, y); }
function go(tab, sub = null) { // tab bar: start fresh at that tab
  if (STACK.length) { UNWIND++; history.go(-STACK.length); STACK = []; }
  show({ tab, sub });
}
function open(tab, sub) { STACK.push({ ...R, y: window.scrollY }); history.pushState({ dc: STACK.length }, ''); show({ tab, sub }); }
function back() { if (STACK.length) history.back(); else show({ tab: R.tab, sub: null }); }
window.addEventListener('popstate', () => {
  if (UNWIND) { UNWIND--; return; }
  const p = STACK.pop(); if (p) show({ tab: p.tab, sub: p.sub }, p.y); else show({ tab: R.tab, sub: null });
});
function render() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  $('#appName').textContent = t('appName'); $('#tagline').textContent = t('tagline'); $('#langBtn').textContent = t('switchLang');
  $('#tabs').innerHTML = TABS.map(([id, ic, k]) => `<button data-tab="${id}" class="${R.tab === id ? 'on' : ''}"><span>${ic}</span>${esc(t(k))}</button>`).join('');
  const v = { today: viewToday, learn: viewLearn, practice: viewPractice, teach: viewTeach, settings: viewSettings }[R.tab] || viewToday;
  $('#view').innerHTML = v(); bindView();
  renderDot();
}
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); };
$('#langBtn').onclick = () => { LANG = LANG === 'en' ? 'zh' : 'en'; lsSet('dc-lang', LANG); render(); };

// ---------- shared bits
const sayBtn = (text, label = '🔊') => `<button class="say" data-say="${esc(text)}" aria-label="play">${label}</button>`;
function wordRow(w) {
  return `<div class="word">${sayBtn(w.zh)}<div class="hz">${esc(w.zh)}</div><div class="grow"><div class="py">${esc(w.py)}</div><div>${esc(w.en)}</div>
    ${w.sign ? `<div class="small muted">✋ ${esc(t('handSign'))}: ${esc(L(w.sign))}</div>` : ''}
    ${w.note ? `<div class="note">${esc(L(w.note))}</div>` : ''}</div></div>`;
}
const doneToday = id => !!(S.days[today()] && S.days[today()][id]);
function finishTask(id) { if (!doneToday(id)) { markTask(S, id); save(); } }

// ---------- TODAY (A's self-study list)
function missionOfToday(u) { const d = new Date(); return u.missions[(d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate()) % u.missions.length]; }
function viewToday() {
  const u = curUnit(), n = streak(S), all = u.self.every(x => doneToday(x.id));
  return `<h1>${esc(t('todayTitle'))}</h1><p class="muted">${esc(t('todayHint'))}</p>
  <div class="card"><div class="streak"><b>${n}</b><span>${esc(t('streak'))} 🔥</span></div><div class="small muted">${esc(unitN(u.n))}: ${esc(L(u.title))}</div></div>
  ${u.self.map(x => {
    const d = doneToday(x.id);
    const extra = x.kind === 'mission' ? `<div class="small">${esc(L(missionOfToday(u)))}</div>` : '';
    const btn = x.kind === 'mission' ? (d ? '' : `<button class="btn gold" data-mission="${x.id}">${esc(t('markDone'))}</button>`)
      : `<button class="btn ${d ? 'ghost' : ''}" data-do="${x.kind}" data-level="${x.level || ''}">${esc(d ? t('again') : t('start'))}</button>`;
    return `<div class="card task ${d ? 'done' : ''}"><div class="check">${d ? '✓' : ''}</div><div class="grow"><div class="tname"><b>${esc(L(x.title))}</b> <span class="small muted">· ${x.min} ${esc(t('minutes'))}</span></div>${extra}</div>${btn}</div>`;
  }).join('')}
  ${all ? `<div class="card" style="text-align:center;font-size:20px">${esc(t('doneToday'))}</div>` : ''}`;
}

// ---------- LESSONS
function viewLearn() {
  if (R.sub) { const u = unitOf(R.sub); return status()[u.id].state === 'open' ? viewUnit(u) : viewClosed(u); }
  const cur = curUnit(), st = status();
  const icon = s => (s.state === 'open' ? (s.passed ? '✅' : '›') : s.state === 'locked' ? '🔒' : '📝');
  const sub = (u, s) => (s.state === 'open' ? L(u.goal) : s.state === 'locked' ? t('lockedShort').replace('{n}', u.n - 1) : t('writingShort'));
  return `<h1>${esc(t('tabLearn'))}</h1>
  <div class="card small"><b>${esc(t('howOpenTitle'))}</b><div>${esc(t('howOpen').replace('{p}', PASS))}</div>
    <div class="muted" style="margin-top:4px">✅ ${esc(t('legendPassed'))} · 🔒 ${esc(t('legendLocked'))} · 📝 ${esc(t('legendWriting'))}</div></div>
  <div class="unitlist">${UNITS.map(u => { const s = st[u.id]; return `<div class="card ${u.id === cur.id ? 'cur' : ''} ${s.state === 'open' ? '' : 'locked'}" data-unit="${u.id}" role="button">
    <div class="num">${u.n}</div><div class="grow"><b>${esc(L(u.title))}</b><div class="small muted">${esc(sub(u, s))}</div></div>${icon(s)}</div>`; }).join('')}</div>`;
}
// What it takes to finish a unit (used on the unit page and on the next unit's locked page).
function passBox(u) {
  const s = status()[u.id];
  return `<div class="card"><b>${esc(t('toFinish').replace('{n}', u.n))}</b> ${s.passed ? '✅' : ''}
    ${s.level ? `<div class="row" style="margin-top:8px"><span class="check" style="${s.game >= PASS ? 'background:var(--ok);border-color:var(--ok);color:#fff' : ''}">${s.game >= PASS ? '✓' : ''}</span>
      <div class="grow">${esc(t('passGame').replace('{l}', s.level).replace('{p}', PASS))}<div class="small muted">${esc(t('best'))}: ${s.game}/10</div></div>
      ${s.game >= PASS ? '' : `<button class="btn gold" data-do="game" data-level="${s.level}">${esc(t('start'))}</button>`}</div>
    <div class="muted small" style="margin:6px 0 0 46px">${esc(t('or'))}</div>` : ''}
    <div class="row" style="margin-top:6px"><span class="check" style="${s.lesson ? 'background:var(--ok);border-color:var(--ok);color:#fff' : ''}">${s.lesson ? '✓' : ''}</span>
      <div class="grow">${esc(t('passLesson'))}</div></div></div>`;
}
function viewClosed(u) {
  const s = status()[u.id], prev = UNITS[UNITS.indexOf(u) - 1];
  const prevOpen = prev && status()[prev.id].state === 'open';
  return `<button class="btn ghost" data-back="1">‹ ${esc(t('back'))}</button>
  <h1>${esc(unitN(u.n))}: ${esc(L(u.title))}</h1>
  ${s.state === 'writing' ? `<div class="card">📝 <b>${esc(t('writingTitle'))}</b><div>${esc(t(prevOpen && status()[prev.id].passed ? 'writingReady' : 'writingText'))}</div></div>` : ''}
  ${prev ? (prevOpen ? passBox(prev) : `<div class="card">🔒 ${esc(t('lockedShort').replace('{n}', prev.n))}</div>`) : ''}
  ${prev && prevOpen && !status()[prev.id].passed ? `<button class="btn big" data-unit="${prev.id}">${esc(t('goUnit').replace('{n}', prev.n))}</button>` : ''}`;
}
function viewUnit(u) {
  return `<button class="btn ghost" data-back="1">‹ ${esc(t('back'))}</button>
  <h1>${esc(unitN(u.n))}: ${esc(L(u.title))}</h1><p><b>${esc(t('goal'))}:</b> ${esc(L(u.goal))}</p>
  <div class="btns"><button class="btn" data-do="cards" data-unit-cards="${u.id}">${esc(t('cards'))}</button><button class="btn gold" data-do="game" data-level="${LEVELS.find(l => l.unit === u.n)?.n || 1}">${esc(t('game'))}</button></div>
  <h2>${esc(t('words'))}</h2><div class="card">${u.words.map(wordRow).join('')}</div>
  <h2>${esc(t('lines'))}</h2><div class="card">${u.lines.map(wordRow).join('')}</div>
  <h2>${esc(t('finishUnit'))}</h2>${passBox(u)}`;
}

// ---------- PRACTICE: cards, game, reader
let CARD = null; // { unit, list, i, flipped, right }
function startCards(unitId) {
  const u = unitOf(unitId) || curUnit();
  CARD = { unit: u.id, list: pickCards(allItems(u), S.cards, 10), i: 0, flipped: false, right: 0 };
  if (R.sub === 'cards') render(); else open('practice', 'cards'); window.scrollTo(0, 0); setTimeout(() => say(CARD.list[0].zh), 150);
}
let GAME = null; // { level, q, i, score, answered }
function startGame(level) {
  GAME = { level: +level || 1, i: 0, score: 0, q: question(+level || 1), answered: null };
  if (R.sub === 'game') render(); else open('practice', 'game'); window.scrollTo(0, 0); setTimeout(() => say(GAME.q.said), 150);
}
function viewPractice() {
  if (R.sub === 'cards' && CARD) return viewCards();
  if (R.sub === 'game' && GAME) return viewGame();
  return `<h1>${esc(t('tabPractice'))}</h1>
  <h2>${esc(t('cards'))}</h2><button class="btn big" data-do="cards">${esc(t('start'))} · ${esc(L(curUnit().title))}</button>
  <h2>${esc(t('game'))}</h2><p class="muted small">${esc(t('gameHint'))}</p>
  <div class="levels">${LEVELS.map(l => `<button data-do="game" data-level="${l.n}"><span class="small muted">${esc(t('level'))} ${l.n}</span><b>${esc(L(l.title))}</b><span class="small muted">${S.best[l.n] ? esc(t('best')) + ' ' + S.best[l.n].score + '/10' : ''}</span></button>`).join('')}</div>
  <h2>${esc(t('reader'))}</h2><p class="muted small">${esc(t('readerHint'))}</p>
  <div class="card"><input type="text" id="rdIn" inputmode="decimal" placeholder="15000" value="${esc(lsGet('dc-rd'))}"><label><input type="checkbox" id="rdPhone"> ${esc(t('phoneMode'))}</label><div id="rdOut"></div></div>`;
}
function readerOut() {
  const raw = $('#rdIn').value.trim(); lsSet('dc-rd', raw);
  const out = $('#rdOut'); if (!raw) { out.innerHTML = ''; return; }
  let rows = [];
  try {
    if ($('#rdPhone').checked) rows = [[phone(raw), '']];
    else {
      const n = +raw.replace(/[,\s¥]/g, '');
      if (!Number.isFinite(n) || n < 0 || n >= 1e8) throw 0;
      if (Math.round(n * 10) !== n * 10) throw 0;
      if (!Number.isInteger(n)) rows = [[price(n), '¥' + n], [price(n, true), '']];
      else { rows = [[zh(n), fmt(n)]]; if (zhShort(n) !== zh(n)) rows.push([zhShort(n), t('shortForm')]); rows.push([price(n), '¥' + fmt(n)]); }
    }
  } catch { out.innerHTML = '<p class="muted">—</p>'; return; }
  out.innerHTML = rows.map(([z, lab]) => `<div class="word">${sayBtn(z)}<div class="grow"><div class="hz" style="text-align:left;font-size:26px">${esc(z)}</div><div class="py">${esc(pinyin(z))}</div>${lab ? `<div class="small muted">${esc(lab)}</div>` : ''}</div></div>`).join('');
}
function viewCards() {
  const c = CARD;
  if (c.i >= c.list.length) {
    return `<h1>${esc(t('roundDone'))}</h1><div class="card" style="text-align:center;font-size:22px">${c.right} / ${c.list.length} ✓</div>
    <div class="btns"><button class="btn ghost" data-back="1">${esc(t('back'))}</button><button class="btn" data-do="cards" data-unit-cards="${c.unit}">${esc(t('again'))}</button></div>`;
  }
  const w = c.list[c.i];
  return `<button class="btn ghost" data-back="1">‹ ${esc(t('back'))}</button>
  <div class="bar"><i style="width:${(c.i / c.list.length) * 100}%"></i></div><p class="muted small">${esc(t('cardsHint'))}</p>
  <div class="card flash" id="flash">
    <div class="en">${esc(w.en)}</div>
    <div class="row">${sayBtn(w.zh)}${sayBtn(w.zh, '🐢').replace('data-say', 'data-slow="1" data-say')}</div>
    <div class="${c.flipped ? '' : 'hidden'}"><div class="hz">${esc(w.zh)}</div><div class="py">${esc(w.py)}</div>
      ${w.sign ? `<div class="small">✋ ${esc(L(w.sign))}</div>` : ''}${w.note ? `<div class="note">${esc(L(w.note))}</div>` : ''}</div>
  </div>
  ${c.flipped ? `<div class="btns"><button class="btn ghost" data-grade="0">${esc(t('notYet'))}</button><button class="btn" data-grade="1">${esc(t('knew'))}</button></div>` : ''}`;
}
function gradeCard(knew) {
  const w = CARD.list[CARD.i]; S.cards[w.id] = grade(S.cards[w.id], knew); if (knew) CARD.right++;
  CARD.i++; CARD.flipped = false;
  if (CARD.i >= CARD.list.length) { if (CARD.unit === curUnit().id) markTask(S, 'cards'); }
  save(); render();
  if (CARD.i < CARD.list.length) setTimeout(() => say(CARD.list[CARD.i].zh), 150);
}
function viewGame() {
  const g = GAME, q = g.q;
  if (g.i >= 10) {
    return `<h1>${esc(t('score'))}: ${g.score} / 10</h1><div class="card" style="text-align:center;font-size:40px">${g.score >= 9 ? '🏆' : g.score >= 6 ? '👍' : '💪'}</div>
    <div class="btns"><button class="btn ghost" data-back="1">${esc(t('back'))}</button><button class="btn" data-do="game" data-level="${g.level}">${esc(t('again'))}</button></div>`;
  }
  const a = g.answered;
  return `<button class="btn ghost" data-back="1">‹ ${esc(t('back'))}</button>
  <div class="row"><b class="grow">${esc(t('level'))} ${g.level} · ${g.i + 1}/10</b><span class="muted">${esc(t('score'))} ${g.score}</span></div>
  <div class="bar"><i style="width:${(g.i / 10) * 100}%"></i></div>
  <p class="muted small">${esc(t('gameHint'))}</p>
  <div class="btns"><button class="btn gold" data-say="${esc(q.said)}">${esc(t('play'))}</button><button class="btn ghost" data-slow="1" data-say="${esc(q.said)}">${esc(t('slow'))}</button></div>
  <div class="choices">${q.choices.map(x => `<button data-pick="${x}" class="${a == null ? '' : x === q.n ? 'right' : x === a ? 'bad' : ''}" ${a == null ? '' : 'disabled'}>${esc(q.label(x))}</button>`).join('')}</div>
  <div class="result">${a == null ? '' : `${a === q.n ? '✅ ' + esc(t('right')) : '❌ ' + esc(t('wrong')) + ' ' + esc(q.label(q.n))}<div><b>${esc(q.said)}</b> · <span class="py">${esc(q.py)}</span></div>
    <button class="btn" data-next style="margin-top:10px">${esc(t('next'))} ›</button>`}</div>`;
}
function pick(x) {
  const g = GAME; if (g.answered != null) return;
  g.answered = x; if (x === g.q.n) g.score++; render();
}
function nextQ() {
  const g = GAME; g.i++; g.answered = null;
  if (g.i >= 10) {
    const b = S.best[g.level]; if (!b || g.score > b.score) S.best[g.level] = { score: g.score, t: Date.now() };
    const task = curUnit().self.find(x => x.kind === 'game'); if (task && task.level === g.level) markTask(S, task.id);
    save(); render(); return;
  }
  g.q = question(g.level); render(); setTimeout(() => say(g.q.said), 150);
}

// ---------- TEACH (S's run sheet)
let TEACH = { unit: null, start: 0, used: 0, run: false, done: {} };
try { Object.assign(TEACH, JSON.parse(lsGet('dc-teach')) || {}); } catch {}
const saveTeach = () => lsSet('dc-teach', JSON.stringify(TEACH));
const elapsed = () => TEACH.used + (TEACH.run ? Date.now() - TEACH.start : 0);
function viewTeach() {
  const u = unitOf(TEACH.unit) || curUnit(); TEACH.unit = u.id;
  let acc = 0; const at = elapsed() / 60000;
  const steps = u.teach.map((s, i) => {
    const from = acc; acc += s.min; const on = at >= from && at < acc && (TEACH.run || TEACH.used);
    return `<div class="card step ${TEACH.done[i] ? 'done' : ''} ${on ? 'on' : ''}">
      <div class="row"><button class="check" data-step="${i}" style="background:${TEACH.done[i] ? 'var(--ok)' : 'none'};color:#fff">${TEACH.done[i] ? '✓' : i + 1}</button>
      <h3 class="grow">${esc(s.title.zh)} <span class="small muted">· ${esc(s.title.en)}</span></h3><span class="mins">${from}–${acc} ${esc(t('minutes'))}</span></div>
      <div class="do"><b>${esc(t('todo'))}：</b>${esc(s.do)}</div>
      ${s.say.map(l => `<div class="line"><b>🗣 ${esc(l.en)}</b><small>${esc(l.zh)}</small></div>`).join('')}</div>`;
  }).join('');
  const hist = Object.entries(S.sessions).sort((a, b) => b[1].t - a[1].t).slice(0, 8);
  const m = Math.floor(elapsed() / 60000), sec = Math.floor(elapsed() / 1000) % 60;
  return `<h1>${esc(t('teachTitle'))}</h1><p class="muted small">${esc(t('teachHint'))}</p>
  <label>${esc(t('unit'))}</label><select id="teachUnit">${UNITS.filter(x => x.ready).map(x => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${x.n}. ${esc(x.title.zh)} · ${esc(x.title.en)}</option>`).join('')}</select>
  <div class="card timer"><span class="clock" id="clock" style="color:${m >= 20 ? 'var(--red)' : 'inherit'}">${m}:${String(sec).padStart(2, '0')}</span>
    <div class="row"><button class="btn" id="tRun">${esc(TEACH.run ? t('timerPause') : t('timerStart'))}</button><button class="btn ghost" id="tReset">${esc(t('timerReset'))}</button></div></div>
  ${steps}
  <h2>${esc(t('words'))}</h2><div class="card">${allItems(u).map(wordRow).join('')}</div>
  <label for="tNote">${esc(t('noteLabel'))}</label><textarea id="tNote" rows="3">${esc(TEACH.note || '')}</textarea>
  <button class="btn big" id="tFinish" style="margin-top:12px">${esc(t('finish'))}</button>
  <h2>${esc(t('history'))}</h2>${hist.length ? hist.map(([, h]) => `<div class="card small"><b>${esc(h.date)}</b> · ${esc(unitN(unitOf(h.unit)?.n ?? '?'))} · ${h.steps}/${h.of} ✓ · ${h.min} ${esc(t('minutes'))}${h.note ? `<div>${esc(h.note)}</div>` : ''}</div>`).join('') : `<p class="muted">${esc(t('none'))}</p>`}`;
}
setInterval(() => { if (R.tab === 'teach' && TEACH.run) { const c = $('#clock'); if (c) { const e = elapsed(); const m = Math.floor(e / 60000); c.textContent = m + ':' + String(Math.floor(e / 1000) % 60).padStart(2, '0'); c.style.color = m >= 20 ? 'var(--red)' : ''; if (e % 60000 < 1000) render(); } } }, 1000);

// ---------- SETTINGS + SYNC
const GH = { token: lsGet('dc-gh-token'), repo: lsGet('dc-gh-repo') || (location.hostname.endsWith('.github.io') ? location.hostname.split('.')[0] + '/deal-chinese-data' : ''),
  who: lsGet('dc-gh-who') || 'A', sha: '', dirty: false, busy: false, again: false, timer: 0, state: '', msg: '' };
const ghFile = () => 'progress-' + GH.who.toLowerCase().replace(/[^a-z0-9-]/g, '') + '.json';
const b64e = s => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o); };
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
const ghFetch = (path, opt = {}) => fetch('https://api.github.com/repos/' + GH.repo + path, { cache: 'no-store', method: opt.method || 'GET', body: opt.body,
  headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', ...(opt.body ? { 'content-type': 'application/json' } : {}) } });
const errKey = st => (st === 401 ? 'errKey' : st === 403 || st === 404 ? 'errPerm' : st === 'public' ? 'errPublic' : 'errNet');
function renderDot() {
  const d = $('#syncDot'); if (!d) return;
  d.className = 'dot ' + (!GH.token ? '' : GH.state);
  d.title = !GH.token ? t('localOnly') : GH.msg ? t(GH.msg) : '';
  const m = $('#syncMsg'); if (m) m.textContent = !GH.token ? t('localOnly') : GH.msg ? t(GH.msg) : '';
}
function setSync(state, msg) { GH.state = state; GH.msg = msg; renderDot(); }
function queueSync() { if (!GH.token) return; clearTimeout(GH.timer); GH.timer = setTimeout(ghSync, 3000); }
async function ghSync() {
  if (!GH.token || !GH.repo) return;
  if (GH.busy) { GH.again = true; return; }
  GH.busy = true; setSync('busy', 'syncing');
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await ghFetch('/contents/' + ghFile());
      if (r.ok) { const j = await r.json(); GH.sha = j.sha; const before = JSON.stringify(S); S = merge(S, JSON.parse(b64d(j.content))); lsSet(KEY, JSON.stringify(S)); if (JSON.stringify(S) !== before) render(); }
      else if (r.status === 404) GH.sha = '';
      else throw r.status;
      const remoteSame = r.ok && !GH.dirty;
      if (remoteSame) break;
      const body = { message: 'progress ' + today(), content: b64e(JSON.stringify(S, null, 1)), ...(GH.sha ? { sha: GH.sha } : {}) };
      GH.dirty = false;
      const p = await ghFetch('/contents/' + ghFile(), { method: 'PUT', body: JSON.stringify(body) });
      if (p.ok) { GH.sha = (await p.json()).content.sha; break; }
      GH.dirty = true;
      if (p.status !== 409 && p.status !== 422) throw p.status; // someone else saved first → read again and merge
    }
    setSync('ok', 'synced');
  } catch (e) { setSync('err', errKey(e)); }
  GH.busy = false;
  if (GH.again) { GH.again = false; queueSync(); }
}
function viewSettings() {
  return `<h1>${esc(t('settings'))}</h1>
  <div class="card"><label for="rate">${esc(t('voiceSpeed'))}: <b id="rateV">${RATE}</b></label><input type="range" id="rate" min="0.4" max="1.2" step="0.1" value="${RATE}" style="width:100%">
    <div class="btns"><button class="btn ghost" data-say="你好！三百五十块。">🔊 ${esc(t('testVoice'))}</button></div>
    ${'speechSynthesis' in window && !VOICE ? `<div class="note">${esc(t('noVoice'))}</div>` : ''}</div>
  <div class="card"><label for="curUnit">${esc(t('currentUnit'))}</label><select id="curUnit">${openUnits().map(u => `<option value="${u.id}" ${u.id === curUnit().id ? 'selected' : ''}>${u.n}. ${esc(L(u.title))}</option>`).join('')}</select></div>
  <div class="card"><b>${esc(t('syncTitle'))}</b><p class="small muted">${esc(t('syncHint'))}</p>
    ${GH.token ? `<p class="small">${esc(GH.repo)} · ${esc(ghFile())}</p><div class="btns"><button class="btn" id="syncNow">${esc(t('syncNow'))}</button><button class="btn ghost" id="syncForget">${esc(t('forget'))}</button></div>`
      : `<label for="ghWho">${esc(t('learner'))}</label><input type="text" id="ghWho" value="${esc(GH.who)}" autocomplete="off">
    <label for="ghRepo">${esc(t('repo'))}</label><input type="text" id="ghRepo" value="${esc(GH.repo)}" placeholder="owner/deal-chinese-data" autocomplete="off">
    <label for="ghKey">${esc(t('key'))}</label><input type="password" id="ghKey" autocomplete="off" placeholder="github_pat_…">
    <div class="btns"><button class="btn" id="syncConnect">${esc(t('connect'))}</button></div>`}
    <div class="msg" id="syncMsg"></div></div>
  <p class="foot">${esc(t('about'))}</p>`;
}
async function connect() {
  const who = $('#ghWho').value.trim(), repo = $('#ghRepo').value.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$|\/$/g, ''), key = $('#ghKey').value.trim();
  if (!/^[A-Za-z0-9-]{1,30}$/.test(who) || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !key) return setSync('err', 'errForm');
  GH.repo = repo; GH.token = key; GH.who = who; setSync('busy', 'syncing');
  try {
    const r = await ghFetch(''); if (!r.ok) throw r.status;
    const j = await r.json(); if (!j.private) throw 'public'; if (!j.permissions || !j.permissions.push) throw 403;
    lsSet('dc-gh-token', key); lsSet('dc-gh-repo', repo); lsSet('dc-gh-who', who); GH.dirty = true; render(); ghSync();
  } catch (e) { GH.token = ''; render(); setSync('err', errKey(e)); }
}

// ---------- events for the current view
function bindView() {
  const v = $('#view');
  v.onclick = e => {
    const el = e.target.closest('[data-do],[data-back],[data-unit],[data-mission],[data-grade],[data-pick],[data-next],[data-step],#flash');
    if (!el || (el.id === 'flash' && e.target.closest('[data-say]'))) return;
    if (el.dataset.do === 'cards') startCards(el.dataset.unitCards);
    else if (el.dataset.do === 'game') startGame(el.dataset.level);
    else if (el.dataset.back) back();
    else if (el.dataset.unit) open('learn', el.dataset.unit);
    else if (el.dataset.mission) { finishTask(el.dataset.mission); render(); }
    else if (el.dataset.grade) gradeCard(el.dataset.grade === '1');
    else if (el.dataset.pick) pick(+el.dataset.pick);
    else if ('next' in el.dataset) nextQ();
    else if (el.dataset.step) { const i = el.dataset.step; TEACH.done[i] = !TEACH.done[i]; saveTeach(); render(); }
    else if (el.id === 'flash' && !CARD.flipped) { CARD.flipped = true; render(); }
  };
  if (R.tab === 'practice' && !R.sub) { $('#rdIn').oninput = readerOut; $('#rdPhone').onchange = readerOut; readerOut(); }
  if (R.tab === 'teach') {
    $('#teachUnit').onchange = e => { TEACH.unit = e.target.value; TEACH.done = {}; saveTeach(); render(); };
    $('#tRun').onclick = () => { if (TEACH.run) { TEACH.used = elapsed(); TEACH.run = false; } else { TEACH.start = Date.now(); TEACH.run = true; } saveTeach(); render(); };
    $('#tReset').onclick = () => { TEACH = { unit: TEACH.unit, start: 0, used: 0, run: false, done: {}, note: '' }; saveTeach(); render(); };
    $('#tNote').oninput = e => { TEACH.note = e.target.value; saveTeach(); };
    $('#tFinish').onclick = () => {
      const u = unitOf(TEACH.unit), id = 's' + Date.now().toString(36);
      S.sessions[id] = { date: today(), unit: u.id, steps: Object.values(TEACH.done).filter(Boolean).length, of: u.teach.length, min: Math.round(elapsed() / 60000), note: (TEACH.note || '').trim(), t: Date.now() };
      TEACH = { unit: u.id, start: 0, used: 0, run: false, done: {}, note: '' }; saveTeach(); save(); render();
    };
  }
  if (R.tab === 'settings') {
    $('#rate').oninput = e => { RATE = +e.target.value; lsSet('dc-rate', String(RATE)); $('#rateV').textContent = RATE; };
    $('#curUnit').onchange = e => { S.unit = e.target.value; S.unitT = Date.now(); save(); };
    if ($('#syncConnect')) $('#syncConnect').onclick = connect;
    if ($('#syncNow')) $('#syncNow').onclick = () => { GH.dirty = true; ghSync(); };
    if ($('#syncForget')) $('#syncForget').onclick = () => { if (!confirm(t('forgetAsk'))) return; GH.token = ''; lsSet('dc-gh-token', ''); setSync('', ''); render(); };
  }
}

render();
if (GH.token) setTimeout(ghSync, 400);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && GH.token) ghSync(); });
