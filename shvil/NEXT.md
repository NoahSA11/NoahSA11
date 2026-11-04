# Next

- **Reading mode (word-tap translation)** — skipped in v1: the Sefaria export has no verifiable word-level alignment between the Hebrew and JPS 1917. Options: a word-aligned, permissively licensed lexicon/morphology dataset (e.g. an openly licensed WLC morphology) with its own audit.
- **Nach and Mishnah** — the data layer is generic (`content.config.ts` corpora). Needed:
  - Nach: add corpora per section (Nevi'im, Ketuvim) with `altStructure` unset; lessons per perek or per group of perakim instead of parshiyot (a `units` strategy in `bank.ts`); pick commentary (e.g. Metzudat David) after checking each version's licence.
  - Mishnah: depth is `[perek][mishnah]`, so "verse" becomes "mishnah"; units = masechet/perek; a Mishnah translation with a known permissive licence; cloze tokenization without te'amim; the audit's RawSource is already generic.
- Haftarah of the week alongside the Parsha of the Week (from the same build-time calendar).
- Aliyah-level lessons (Sefaria's Parasha nodes already carry aliyah refs) for shorter sessions.
- English Rashi per comment, if a verified Hebrew↔English comment alignment becomes available.
- Optional audio (only from a licensed, verified source).
- Run e2e/screenshots in CI with a Playwright container.
- Split each book file so Rashi English loads lazily (~30% of book size).
