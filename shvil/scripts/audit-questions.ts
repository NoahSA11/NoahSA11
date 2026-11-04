/**
 * Audit EVERY shipped question (public/content/bank-*.json) against the raw
 * Sefaria snapshots in data/raw/, and check the shipped verse text is
 * byte-identical to the raw text. Exits non-zero on any violation.
 * Usage: npx tsx scripts/audit-questions.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { auditAll, makeAuditContext } from '../src/engine/audit.ts';
import type { BookContent, ContentIndex, QuestionBank } from '../src/engine/types.ts';
import { loadRawSource, ROOT } from './raw-source.ts';

const OUT = join(ROOT, 'public', 'content');
const src = loadRawSource();
const ctx = makeAuditContext(src);
const index: ContentIndex = JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8'));
const errs: string[] = [];
const counts: Record<string, number> = {};
let total = 0;

if (index.books.map((b) => b.title).join() !== src.books.join()) errs.push('index books differ from raw books');
for (const b of index.books) {
  const content: BookContent = JSON.parse(readFileSync(join(OUT, b.file), 'utf8'));
  content.chapters.forEach((ch, ci) => ch.forEach((v, vi) => {
    if (v.he !== src.verse(b.title, ci + 1, vi + 1)) errs.push(`content ${b.title} ${ci + 1}:${vi + 1} differs from raw`);
  }));
  if (content.chapters.length !== src.chapterCount(b.title)) errs.push(`content ${b.title} chapter count differs`);
  const rawP = src.parshiyot(b.title);
  if (JSON.stringify(content.parshiyot.map((p) => [p.id, p.start, p.end])) !== JSON.stringify(rawP.map((p) => [p.id, p.start, p.end]))) errs.push(`${b.title} parsha ranges differ from raw schema`);
  const bank: QuestionBank = JSON.parse(readFileSync(join(OUT, b.bankFile), 'utf8'));
  errs.push(...auditAll(ctx, bank.questions));
  for (const q of bank.questions) counts[q.type] = (counts[q.type] ?? 0) + 1;
  total += bank.questions.length;
}

console.log(`Audited ${total} questions ${JSON.stringify(counts)} across ${index.books.length} books against data/raw.`);
if (errs.length) {
  console.error(`AUDIT FAILED: ${errs.length} violation(s)`);
  for (const e of errs.slice(0, 50)) console.error('  ' + e);
  process.exit(1);
}
console.log('AUDIT PASSED: 0 violations.');
