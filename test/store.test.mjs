import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, merge, grade, markTask, streak, question, today } from '../public/store.js';

test('merge keeps newest of each and loses nothing', () => {
  const a = freshState(), b = freshState();
  a.cards.n1 = { box: 3, due: 1, t: 10 }; b.cards.n1 = { box: 1, due: 1, t: 20 }; b.cards.n2 = { box: 2, due: 1, t: 5 };
  a.days['2026-11-17'] = { cards: 100 }; b.days['2026-11-17'] = { game: 200, cards: 50 };
  a.best[1] = { score: 9, t: 1 }; b.best[1] = { score: 7, t: 9 };
  b.unit = 'u2'; b.unitT = 5;
  const m = merge(a, b);
  assert.equal(m.cards.n1.box, 1); assert.ok(m.cards.n2);
  assert.deepEqual(m.days['2026-11-17'], { cards: 50, game: 200 });
  assert.equal(m.best[1].score, 9); assert.equal(m.unit, 'u2');
  assert.deepEqual(merge(m, m), m);
});
test('grade and streak', () => {
  assert.equal(grade(undefined, true, 0).box, 1);
  assert.equal(grade({ box: 4, due: 0 }, false, 0).box, 1);
  const s = freshState(), d = new Date(2026, 10, 17);
  for (let i = 1; i <= 3; i++) markTask(s, 'x', today(new Date(2026, 10, 17 - i)));
  assert.equal(streak(s, d), 3);
  markTask(s, 'x', today(d)); assert.equal(streak(s, d), 4);
});
test('game questions are valid at every level', () => {
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let level = 1; level <= 5; level++) for (let i = 0; i < 300; i++) {
    const q = question(level, rnd);
    assert.equal(q.choices.length, 4, 'level ' + level);
    assert.equal(new Set(q.choices).size, 4);
    assert.ok(q.choices.includes(q.n));
    assert.ok(q.said && q.py);
  }
});
