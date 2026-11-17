# Deal Chinese — notes for Claude

Business-Mandarin site for A (learner, English speaker) taught by S (Chinese native).
Separate from hsk1-tandem (that one stays as it is). See SPEC.md and PROGRESS.md.
Public repo: no personal details (no names beyond initials S/A, no hometown, no job history).

## Stack (zero dependencies)
- `public/` = the whole static site (GitHub Pages deploys this folder). `server.mjs` only serves it locally (port 8775).
- `numbers.js` number → Chinese/pinyin (pure, tested). `content.js` units 1–5 (numbers) + imports `units-talk.js` units 6–12 (dialog, traps, meaning quiz).
- `store.js` state + `merge()` for sync (pure, tested). `app.js` UI. `i18n.js` UI strings {en, zh}.
- Sync: GitHub contents API, private repo (default skot-chen/deal-chinese-data), file `progress-<learner>.json`.
  Key in localStorage `dc-gh-token` only.
- Content is ORIGINAL. Pinyin with tone marks; check every new word. Each unit's `teach` steps must sum to 20 min.

## Commands
`npm run check` · `start.bat` / `npm start` · preview config `deal-chinese` (port 8775).
Never test sync against the real data repo.
