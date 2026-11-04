/**
 * Build app content from the committed Sefaria snapshots in data/raw/.
 *  - public/content/<Book>.json      verses (he, en, Rashi he/en) + parshiyot
 *  - public/content/bank-<Book>.json deterministic question bank
 *  - public/content/index.json       books, sizes, credits (from data/manifest.json)
 *  - public/content/calendar.json    weekly parsha table (Israel + Diaspora), computed
 *                                    at build time with @hebcal/core
 * Usage: npx tsx scripts/build-content.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { HebrewCalendar } from '@hebcal/core';
import { loadAllBooks, readJson } from './load-content.ts';
import { buildCorpusIndex } from '../src/engine/corpus-index.ts';
import { bookBank } from '../src/engine/questions/bank.ts';
import type { BookContent, ContentIndex } from '../src/engine/types.ts';

const ROOT = join(import.meta.dirname, '..');
const OUT = join(ROOT, 'public', 'content');

const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
/** hebcal spelling → Sefaria spelling, only where they differ (verified by the check below). */
const HEBCAL_ALIASES: Record<string, string> = {};

function buildCalendar(parshaIds: string[]) {
  const bySlug = new Map(parshaIds.map((id) => [slug(id), id]));
  const resolve = (n: string) => {
    const id = bySlug.get(slug(HEBCAL_ALIASES[n] ?? n));
    if (!id) throw new Error(`Calendar: hebcal parsha "${n}" has no Sefaria match — add an alias.`);
    return id;
  };
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const out: Record<'il' | 'diaspora', [string, string[]][]> = { il: [], diaspora: [] };
  for (const il of [true, false]) {
    const ev = HebrewCalendar.calendar({ start: new Date(2024, 0, 1), end: new Date(2040, 11, 31), sedrot: true, noHolidays: true, il });
    for (const e of ev) {
      const names = (e as unknown as { parsha?: string[] }).parsha;
      if (!names) continue;
      out[il ? 'il' : 'diaspora'].push([key(e.getDate().greg()), names.map(resolve)]);
    }
  }
  return { generatedBy: '@hebcal/core (build time)', from: '2024-01-01', to: '2040-12-31', ...out };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const manifest = readJson(join(ROOT, 'data', 'manifest.json'));
  const index: ContentIndex = { version: 1, builtFrom: `Sefaria-Export ${manifest.exportDate ?? ''}`.trim(), books: [], credits: [] };
  const all: BookContent[] = loadAllBooks();
  const ix = buildCorpusIndex(all);
  let total = 0;
  for (const b of all) {
    const bank = bookBank(b, ix);
    const file = `${b.title}.json`;
    const bankFile = `bank-${b.title}.json`;
    const s1 = JSON.stringify(b);
    const s2 = JSON.stringify(bank);
    writeFileSync(join(OUT, file), s1);
    writeFileSync(join(OUT, bankFile), s2);
    total += bank.questions.length;
    index.books.push({ title: b.title, heTitle: b.heTitle, corpus: b.corpus, parshiyot: b.parshiyot, file, bankFile, bytes: Buffer.byteLength(s1), bankBytes: Buffer.byteLength(s2), questionCount: bank.questions.length });
    const byType: Record<string, number> = {};
    for (const q of bank.questions) byType[q.type] = (byType[q.type] ?? 0) + 1;
    console.log(`${b.title}: ${b.parshiyot.length} parshiyot, ${bank.questions.length} questions ${JSON.stringify(byType)}, ${(s1.length / 1024).toFixed(0)}+${(s2.length / 1024).toFixed(0)} KB`);
  }
  index.credits = manifest.entries
    .filter((e: { kind: string }) => e.kind === 'text')
    .map(({ file, title, language, versionTitle, versionTitleInHebrew, versionSource, license, url }: Record<string, string>) => ({ file, title, language, versionTitle, versionTitleInHebrew, versionSource, license, url }));
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(index));
  const cal = buildCalendar(all.flatMap((b) => b.parshiyot.map((p) => p.id)));
  writeFileSync(join(OUT, 'calendar.json'), JSON.stringify(cal));
  console.log(`Total questions: ${total}. Calendar weeks: il=${cal.il.length} diaspora=${cal.diaspora.length}`);
}

main();
