import test from 'node:test';
import assert from 'node:assert/strict';
import { zh, zhShort, price, phone, pinyin } from '../public/numbers.js';

test('formal numbers', () => {
  const cases = { 0: '零', 4: '四', 10: '十', 14: '十四', 40: '四十', 20: '二十', 101: '一百零一', 110: '一百一十', 200: '两百',
    350: '三百五十', 1005: '一千零五', 1050: '一千零五十', 2000: '两千', 2222: '两千两百二十二', 10000: '一万', 20000: '两万',
    15000: '一万五千', 10005: '一万零五', 100000: '十万', 120000: '十二万', 1000000: '一百万', 10010: '一万零一十' };
  for (const [n, z] of Object.entries(cases)) assert.equal(zh(+n), z, n);
  assert.throws(() => zh(1e8));
});
test('everyday short forms', () => {
  assert.equal(zhShort(350), '三百五');
  assert.equal(zhShort(110), '一百一');
  assert.equal(zhShort(2500), '两千五');
  assert.equal(zhShort(18000), '一万八');
  assert.equal(zhShort(305), '三百零五');
  assert.equal(zhShort(14), '十四');
});
test('prices, phone, pinyin', () => {
  assert.equal(price(35.5), '三十五块五');
  assert.equal(price(35.5, true), '三十五块五毛');
  assert.equal(price(0.5), '五毛');
  assert.equal(price(200), '两百块');
  assert.equal(phone('138 0013'), '幺三八零零幺三');
  assert.equal(pinyin('一百'), 'yì bǎi');
  assert.equal(pinyin('一万五'), 'yí wàn wǔ');
  assert.equal(pinyin('十一'), 'shí yī');
});
