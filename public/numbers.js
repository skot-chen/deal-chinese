// Numbers → spoken Mandarin (characters + pinyin). Pure functions, tested in test/numbers.test.mjs.
const D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PY = { 零: 'líng', 一: 'yī', 二: 'èr', 两: 'liǎng', 三: 'sān', 四: 'sì', 五: 'wǔ', 六: 'liù', 七: 'qī', 八: 'bā', 九: 'jiǔ',
  十: 'shí', 百: 'bǎi', 千: 'qiān', 万: 'wàn', 块: 'kuài', 毛: 'máo', 元: 'yuán', 角: 'jiǎo', 幺: 'yāo', 点: 'diǎn' };

// 1..9999. lead = this is the start of the whole number (then 10–19 is 十X, not 一十X).
function small(n, lead) {
  const parts = [[Math.floor(n / 1000), '千'], [Math.floor(n / 100) % 10, '百'], [Math.floor(n / 10) % 10, '十'], [n % 10, '']];
  let out = '', gap = false;
  for (const [v, unit] of parts) {
    if (!v) { if (out) gap = true; continue; }
    if (gap) { out += '零'; gap = false; }
    if (unit === '十' && v === 1 && !out && lead) out += '十';
    else out += (v === 2 && (unit === '千' || unit === '百') ? '两' : D[v]) + unit;
  }
  return out;
}

/** Formal spoken form: 350 → 三百五十, 10005 → 一万零五. Works for 0 ≤ n < 100,000,000. */
export function zh(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e8) throw new RangeError('0..99999999 only: ' + n);
  if (n === 0) return '零';
  if (n < 1e4) return small(n, true);
  const w = Math.floor(n / 1e4), r = n % 1e4;
  let out = (w === 2 ? '两' : small(w, true)) + '万';
  if (r) out += (r < 1000 ? '零' : '') + small(r, false);
  return out;
}

/** Everyday short form when it exists: 350 → 三百五, 110 → 一百一, 2500 → 两千五, 18000 → 一万八. Else same as zh(). */
export function zhShort(n) {
  for (const [base, unit] of [[1e4, '万'], [1000, '千'], [100, '百']]) {
    if (n < base || n >= base * 10) continue;
    const a = Math.floor(n / base), b = (n % base) / (base / 10);
    if (Number.isInteger(b) && b > 0) return zh(a * base) + D[b];
  }
  return zh(n);
}

/** Price: 35.5 → 三十五块五 (short) / 三十五块五毛 (full). Max one decimal (毛 = 0.1 元). */
export function price(yuan, full = false) {
  const k = Math.floor(yuan), m = Math.round((yuan - k) * 10);
  if (m === 10) return price(k + 1, full);
  if (!m) return zh(k) + '块';
  if (!k) return D[m] + '毛';
  return zh(k) + '块' + D[m] + (full ? '毛' : '');
}

/** Phone number digit by digit, 1 = 幺 (yāo): "138" → 幺三八. */
export function phone(digits) {
  return String(digits).replace(/\D/g, '').split('').map(c => (c === '1' ? '幺' : D[+c])).join('');
}

/** Pinyin for a string of number characters, with the 一 tone change before 百/千/万 (yìbǎi, yìqiān, yíwàn). */
export function pinyin(text) {
  const chars = [...text], out = [];
  chars.forEach((c, i) => {
    let p = PY[c] || c;
    if (c === '一') { const nx = chars[i + 1]; if (nx === '万') p = 'yí'; else if (nx === '百' || nx === '千') p = 'yì'; }
    out.push(p);
  });
  return out.join(' ');
}

/** Format a number for the eye: 15000 → "15,000". */
export const fmt = n => n.toLocaleString('en-US');
