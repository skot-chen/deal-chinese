import test from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, allItems } from '../public/content.js';
import { T } from '../public/i18n.js';

test('units are well formed', () => {
  const ids = new Set();
  for (const u of UNITS) {
    assert.ok(u.title.en && u.title.zh, u.id);
    if (!u.ready) continue;
    assert.equal(u.teach.reduce((s, x) => s + x.min, 0), 20, u.id + ' teach must be 20 min');
    for (const st of u.teach) assert.ok(st.do && st.say.every(l => l.en && l.zh));
    for (const w of allItems(u)) { assert.ok(w.id && w.zh && w.py && w.en, w.id); assert.ok(!ids.has(w.id), 'dup ' + w.id); ids.add(w.id); }
    assert.ok(u.self.length === 3 && u.missions.length >= 3);
  }
});
test('every UI string has en and zh', () => {
  for (const [k, v] of Object.entries(T)) assert.ok(v.en && v.zh, k);
});
test('talk units have dialogues and traps', () => {
  for (const u of UNITS.filter(x => x.n >= 6)) {
    assert.ok(u.dialog.length >= 4 && u.dialog.every(l => (l.who === 'you' || l.who === 'boss') && l.zh && l.py && l.en), u.id);
    for (const tr of u.traps) assert.ok(tr.answer && tr.wrong.length === 3 && !tr.wrong.includes(tr.answer), u.id);
  }
  assert.equal(UNITS.filter(u => u.ready).length, 12);
});
test('quiz rounds are valid', async () => {
  const { quizRound } = await import('../public/store.js');
  for (const u of UNITS.filter(x => x.n >= 6)) {
    const qs = quizRound(u, allItems(u));
    assert.equal(qs.length, 10, u.id);
    for (const q of qs) { assert.equal(new Set(q.choices).size, 4, u.id + ' ' + q.zh); assert.ok(q.choices.includes(q.answer)); }
  }
});
