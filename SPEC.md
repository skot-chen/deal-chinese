# Deal Chinese — spec

A phone-first website that teaches a busy adult learner (English speaker)
the Mandarin he needs to do business in China without being cheated: numbers, prices, bargaining, deposits,
delivery, and a simple phone call. Not a textbook course.

People: **A** = learner (main user, UI defaults to English). **S** = Chinese native teacher,
teaches 1 × 20 min per week.

## Method (mirrors how A trains sales)
1. Learn alone — 5 min a day on the phone, listening first, no writing characters.
2. Drill one part with a partner — 20 min a week with S, one call stage at a time, role-play.
3. Do it for real — one small real-world mission per week.

## Acceptance criteria
- AC1 UI in English by default; one button switches to Chinese (中文) and back; choice remembered.
- AC2 Two task lists: **Teach** (S's 20-min run sheet: steps, minutes, timer, lines to say in EN with ZH meaning)
  and **Today** (A's daily self-study, 3 tasks ≈ 5 min, check off, streak).
- AC3 Every Chinese item shows characters + pinyin + English and can be played aloud (browser zh-CN voice).
- AC4 Number listening game with levels (0–10, 11–99, hundreds, thousands, 万, prices with 块/毛),
  4 choices with "trap" distractors (4/10, 110/101, 1.5万/1500…). Number reader: type a number → Chinese + voice.
- AC5 Works with no key (progress saved in this browser only). With a GitHub key + private repo, progress syncs
  between devices (one file per learner). Key stays only in the browser, never in code; public repos refused.
- AC6 Static site on GitHub Pages (skot-chen). License: non-commercial only, all content © skot-chen.
- AC7 `npm run check` < 2 s: number conversion, content integrity (teach steps = 20 min), sync merge.

## Milestones
- M1 Shell (tabs, language toggle, voice, storage, sync) + Unit 1 (0–10, phone numbers, survival lines) + game.
- M2 Units 2–5 (11–99, 百/千/两, 万, money).
- M3 Units 6–10 (asking price, discounts 折, deposit 定金/订金 & tax, quantity/MOQ, dates/delivery).
- M4 Units 11–12 (phone call, full call role-play) + publish.
