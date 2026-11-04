# Decisions

Recorded as they were made, in place of asking.

## Repository layout
- This repository is the owner's GitHub **profile** repo (its root README is shown on the profile page). The app lives in `shvil/` so the profile README is untouched; the workflow is at the root (`.github/workflows/shvil.yml`) with `working-directory: shvil`. Vite uses `base: './'`, so the build works at any Pages path.

## Data source and network
- `www.sefaria.org` and `developers.sefaria.org` were **blocked** by this environment's network policy (proxy 403). GitHub raw content was reachable. The Sefaria-Export README there says the dataset files now live in the public GCS bucket `storage.googleapis.com/sefaria-export`, which was also reachable. So all data comes from the **official Sefaria-Export dataset**: index `books.json` on GitHub, files on GCS. No data was invented or typed from memory.
- Because the developer docs were unreachable, licensing was determined from the `license` field inside each downloaded version JSON (the same field the Sefaria API exposes). The fetch script refuses any version whose licence field is missing or not in an allow-list. To refresh against the live API instead, allow `www.sefaria.org`.
- Parsha boundaries come from Sefaria's own index schema (`schemas/<Book>.json`, alt structure `Parasha`). The build checks they tile each book with no gaps.

## Text versions (licence table)

| Use | Version title | Licence | Why |
|---|---|---|---|
| Hebrew Torah | Tanach with Ta'amei Hamikra | Public Domain | WLC-based, full nikud + te'amim, PD. (“Miqra according to the Masorah” is CC-BY-SA: avoided.) |
| English | The Holy Scriptures: A New Translation (JPS 1917) | Public Domain | Clean, complete, PD. (Modernized Tanakh is CC-BY: fine but derivative; JPS 1985/2006 are not free.) |
| Rashi Hebrew | Rosenbaum & Silbermann 1929–1934 (Numbers: “-- corrected vocalization”) | Public Domain | Vocalized, PD, has a matching English edition. Numbers is published only under the corrected-vocalization title in the export. |
| Rashi English | Rosenbaum & Silbermann 1929–1934 | Public Domain | PD. |

All licences are permissive; the project is still described as personal / non-commercial.

## Text handling
- Stored text is never modified. Display transforms: remove te'amim (U+0591–U+05AF, meteg U+05BD, paseq) when cantillation is off; divine-name substitution when chosen.
- Ketiv/qere in this version is “unpointed ketiv followed by [pointed qere]”. Displayed as (ketiv) in small grey followed by the qere. Ketiv, qere, (פ)/(ס) markers and paseq are **never** used as cloze answers or distractors.
- Divine names are never hidden in a cloze, and never used as distractors.
- Divine-name setting: “substituted” shows the Tetragrammaton as ה׳ (prefix letters kept) and Elohim forms with ק, in prompts, options, learn cards and feedback — display only. The Sefaria link always shows the original. English (JPS 1917) is left as published.
- Rashi: the bold lemma (dibur hamatchil) is split from the body. A Rashi-match prompt shows the body; the lemma is behind a “show” toggle because it usually quotes the answer pasuk. English Rashi is shown per pasuk (all comments) in feedback, not as a question prompt, because the Hebrew and English editions' comment segmentation does not line up 1:1 (e.g. Genesis: 2,016 vs 2,001 comments), so per-comment alignment cannot be verified.

## Question generation
- Banks are generated **at build time** (seed `shvil-bank-v1`), not at runtime, so the audit can check every question the app can ever show. Runtime only selects from the bank with a seeded PRNG (mulberry32 + FNV-1a).
- Per parsha (caps): 36 cloze, 8 order, 12 where, 14 Rashi, 6 first/last → 4,073 questions.
- Cloze: one plain word (≥2 letters, no maqaf compound, not a divine name), in pesukim with ≥4 words. Distractors prefer ±1/±2 neighbouring pesukim (same-pasuk words are visible in the prompt, so they come last). A distractor is rejected if it normalizes (consonants + nikud, no te'amim) to the answer, or if substituting it produces any real pasuk in the Torah.
- “Where”: a pasuk is distinctive if it has ≥6 words, its text is unique in the Torah, and fewer than half of its 3-word sequences occur elsewhere. This excludes formulas like “וַיְדַבֵּר יְהוָה אֶל־מֹשֶׁה לֵּאמֹר”. Parsha distractors come from within ±4 parshiyot; perek distractors from within ±6 chapters.
- Order: windows with identical pesukim are rejected (order would be ambiguous); the shuffle is never the identity.
- First/last: starts at 3 words and grows to 6 until all four options are distinct.
- Reading mode (word-tap translation) is **skipped**: the export has no verifiable word alignment for JPS 1917. See NEXT.md.

## Calendar
- Weekly parsha table for 2024–2040, Israel and Diaspora, computed **at build time** with `@hebcal/core` (a vetted library) and shipped as `calendar.json`; the GPL library code is not shipped. Build fails if any hebcal parsha name has no Sefaria match. Tests check every row is a Shabbat, all 53 Shabbat parshiyot appear (V'Zot HaBerachah is read on Simchat Torah), and no parsha repeats in a cycle. Default is Israel; changeable in settings.
- Project licence GPL-2.0-or-later to stay clearly compatible with the build-time dependency.

## Game design
- Leitner boxes with intervals 0/1/2/4/8/16/32 days; wrong → box 1, due the same day. Mastery = average box (capped at 4) over the parsha's bank.
- Streak: calendar days by local date key (never millisecond deltas), so DST and timezones can't create 23/25-hour days. One freeze covers one missed day and is re-earned every 7 days (max 1). Clock going backwards is ignored.
- Hearts: 5 per lesson, lessons only. At 0 the lesson ends kindly (“let's pause here”), with no completion bonus; answers still feed spaced repetition.
- XP: 10 per correct answer, +20 lesson, +10 perfect, +30 daily, +50 weekly quest. Seven levels from “צעד ראשון” to “תלמיד חכם”.
- First parsha of every book is unlocked; completing a parsha unlocks the next. Placement: 8 questions from the chosen parsha, 6 correct unlocks up to it.
- Reverence: no sounds, no buzzers, no confetti. A quiet ✦ animates only on the lesson-complete screen (disabled under `prefers-reduced-motion`).
- Daily: questions chosen from all banks with a pattern of types, seeded by `shvil-daily:<local date>`; the same for everyone on that date. Share text uses 🟩/⬜.

## Stack
- Vite + strict TypeScript + vanilla DOM/SVG (no framework: about 6 screens, and engine logic is DOM-free). Vitest for tests.
- Playwright: the pre-installed copy is loaded with `require()`; a small `scripts/playwright.d.ts` gives types, so a second Playwright (without a matching browser) is never installed. E2E and screenshots are local scripts, not CI steps (CI has no preview server/browser setup).
- Hand-written service worker (`scripts/build-sw.ts`): precaches the shell, then all content in the background; cache-first.
- Progress schema v2. v1 (prototype shape: flat streak, list of completed parshiyot, box map) migrates to v2; imports are validated and sanitized; newer schemas are refused.
- `?today=YYYY-MM-DD` URL parameter overrides “today”, for deterministic screenshots/tests.

## Sizes
- `data/raw/`: 8.2 MB. Shipped content: 9.4 MB raw / 2.8 MB gzip (books 1.3–1.9 MB each, banks ~0.4 MB each). JS 15 KB gz, CSS 4 KB gz.
