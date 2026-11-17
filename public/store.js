// Progress state, spaced review and sync merge. Pure (no DOM), tested in test/store.test.mjs.
import { zh, zhShort, price, pinyin, fmt } from './numbers.js';

export const freshState = () => ({ v: 1, cards: {}, days: {}, sessions: {}, best: {}, unit: 'u1', unitT: 0 });

export const today = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// ---- spaced review (Leitner boxes). Box 0 = new. Days until next review per box:
const GAP = [0, 1, 2, 4, 7, 14];
const DAY = 864e5;
export function grade(card = { box: 0, due: 0 }, knew, now = Date.now()) {
  const box = knew ? Math.min(card.box + 1, GAP.length - 1) : 1;
  return { box, due: knew ? now + GAP[box] * DAY - 3600e3 : now, t: now };
}
/** Order items for a card round: due/new first, then the rest; at most `max`. */
export function pickCards(items, cards, max = 10, now = Date.now()) {
  const due = items.filter(i => !cards[i.id] || cards[i.id].due <= now);
  const rest = items.filter(i => !due.includes(i)).sort((a, b) => cards[a.id].due - cards[b.id].due);
  return [...due, ...rest].slice(0, max);
}

// ---- days & streak
export function markTask(s, taskId, date = today(), now = Date.now()) {
  (s.days[date] ||= {})[taskId] ||= now;
  return s;
}
export function streak(s, date = new Date()) {
  let n = 0; const d = new Date(date);
  if (!s.days[today(d)]) d.setDate(d.getDate() - 1); // today not done yet → count from yesterday
  while (s.days[today(d)] && Object.keys(s.days[today(d)]).length) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---- merge two copies (this device + GitHub). Nothing is ever lost: newest wins per item.
const newer = (x, y) => (!x ? y : !y ? x : (y.t || 0) > (x.t || 0) ? y : x);
export function merge(a, b) {
  a = { ...freshState(), ...a }; b = { ...freshState(), ...b };
  const out = freshState();
  for (const k of ['cards', 'sessions']) for (const id of new Set([...Object.keys(a[k]), ...Object.keys(b[k])])) out[k][id] = newer(a[k][id], b[k][id]);
  for (const d of new Set([...Object.keys(a.days), ...Object.keys(b.days)])) {
    out.days[d] = { ...b.days[d] };
    for (const [t, ts] of Object.entries(a.days[d] || {})) out.days[d][t] = Math.min(ts, out.days[d][t] || Infinity);
  }
  for (const l of new Set([...Object.keys(a.best), ...Object.keys(b.best)])) {
    const x = a.best[l], y = b.best[l];
    out.best[l] = !x ? y : !y ? x : y.score > x.score ? y : x;
  }
  const u = (b.unitT || 0) > (a.unitT || 0) ? b : a; out.unit = u.unit; out.unitT = u.unitT;
  return out;
}

// ---- listening game
const ri = (rnd, lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const swap2 = n => { const s = String(n); return s.length === 2 ? +(s[1] + s[0]) : n; };
/** Tricky wrong answers for a number at a level (the mistakes people really make). */
function traps(level, n) {
  if (level === 1) return n === 4 ? [10] : n === 10 ? [4] : [];
  if (level === 2) { const t = Math.floor(n / 10), o = n % 10; return [swap2(n), o ? o * 10 + t : t, n + 1, n - 1]; }
  if (level === 3) return [n / 10, n * 10, n + 1, n - (n % 100) + (n % 100) / 10, n - (n % 100) + Math.floor((n % 100) / 10)];
  if (level === 4) return [n / 10, n * 10, n + 5, Math.floor(n / 1e4) * 1e4 + Math.floor((n % 1e4) / 1000)];
  return [n * 10, n / 10, Math.floor(n), n + 1];
}
function draw(level, rnd) {
  if (level === 1) return ri(rnd, 0, 10);
  if (level === 2) return ri(rnd, 11, 99);
  if (level === 3) return rnd() < 0.6 ? ri(rnd, 1, 9) * 100 + ri(rnd, 1, 9) * 10 : ri(rnd, 1, 9) * (rnd() < 0.5 ? 100 : 1000) + ri(rnd, 0, 99) * (rnd() < 0.5 ? 1 : 10);
  if (level === 4) return rnd() < 0.6 ? ri(rnd, 1, 9) * 1e4 + ri(rnd, 1, 9) * 1000 : ri(rnd, 1, 99) * 1e4;
  return rnd() < 0.5 ? ri(rnd, 1, 99) + ri(rnd, 1, 9) / 10 : ri(rnd, 1, 999);
}
const ok = (level, x) => Number.isFinite(x) && x >= 0 && x < 1e8 && (level === 5 ? Math.round(x * 10) === x * 10 : Number.isInteger(x));
/** One question: what is heard (zh + pinyin), the answer and 4 shuffled choices. */
export function question(level, rnd = Math.random) {
  const n = draw(level, rnd);
  const said = level === 5 ? price(n) : rnd() < 0.5 ? zhShort(n) : zh(n);
  const pool = [...new Set(traps(level, n).filter(x => ok(level, x) && x !== n))];
  const choices = new Set([n]);
  for (const x of pool) if (choices.size < 4) choices.add(x);
  for (let i = 0; choices.size < 4 && i < 200; i++) { const x = draw(level, rnd); if (ok(level, x)) choices.add(x); }
  const list = [...choices].sort(() => rnd() - 0.5);
  return { n, said, py: pinyin(said), choices: list, label: x => (level === 5 ? '¥' + x : fmt(x)) };
}
