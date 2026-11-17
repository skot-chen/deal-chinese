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
