// Local static server for public/ (the real site is static on GitHub Pages).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { exec } from 'node:child_process';
const ROOT = join(import.meta.dirname, 'public'), PORT = +process.env.PORT || 8775;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = normalize(join(ROOT, p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': (TYPES[extname(f)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control': 'no-store' }); res.end(b); }
  catch { res.writeHead(404); res.end('not found'); }
}).listen(PORT, () => {
  console.log('Deal Chinese on http://localhost:' + PORT);
  if (process.argv.includes('--open')) exec('start http://localhost:' + PORT);
});
