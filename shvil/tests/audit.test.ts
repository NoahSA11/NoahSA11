/** Proves the audit's failure mode: injected bad questions must be rejected. */
import { describe, expect, it } from 'vitest';
import { loadAllBooks } from '../scripts/load-content.ts';
import { loadRawSource } from '../scripts/raw-source.ts';
import { auditAll, auditQuestion, makeAuditContext } from '../src/engine/audit.ts';
import { buildCorpusIndex } from '../src/engine/corpus-index.ts';
import { bookBank } from '../src/engine/questions/bank.ts';
import type { ClozeQ, FirstLastQ, OrderQ, Question, RashiQ, WhereQ } from '../src/engine/types.ts';

const ctx = makeAuditContext(loadRawSource());
const books = loadAllBooks();
const bank = bookBank(books[0]!, buildCorpusIndex(books)).questions;
const first = <T extends Question>(t: T['type']) => structuredClone(bank.find((q) => q.type === t)) as T;
const bad = (q: Question) => expect(auditQuestion(ctx, q).length).toBeGreaterThan(0);

describe('audit rejects bad questions', () => {
  it('accepts the untouched originals', () => {
    for (const t of ['cloze', 'order', 'where', 'rashi', 'firstlast'] as const) expect(auditQuestion(ctx, first(t))).toEqual([]);
  });
  it('cloze: answer not at the stated ref', () => {
    const q = first<ClozeQ>('cloze');
    q.ref = { ...q.ref, v: q.ref.v + 1 };
    q.options[q.answerIndex]!.ref = q.ref;
    bad(q);
  });
  it('cloze: fabricated answer text', () => {
    const q = first<ClozeQ>('cloze');
    q.answer = 'שָׁלוֹם';
    q.options[q.answerIndex]!.text = 'שָׁלוֹם';
    bad(q);
  });
  it('cloze: distractor that is actually correct', () => {
    const q = first<ClozeQ>('cloze');
    const d = (q.answerIndex + 1) % 4;
    q.options[d] = { ...q.options[q.answerIndex]! };
    bad(q);
  });
  it('cloze: distractor from a far-away pasuk', () => {
    const q = first<ClozeQ>('cloze');
    const d = (q.answerIndex + 1) % 4;
    q.options[d] = { text: 'וַיְכֻלּ֛וּ', ref: { book: 'Genesis', c: 2, v: 1 }, tokenIndex: 0 };
    q.ref = { book: 'Genesis', c: 1, v: 4 };
    bad(q);
  });
  it('order: non-consecutive pesukim', () => {
    const q = first<OrderQ>('order');
    q.refs[1] = { ...q.refs[1]!, v: q.refs[1]!.v + 1 };
    bad(q);
  });
  it('order: shuffle equal to answer', () => {
    const q = first<OrderQ>('order');
    q.shuffled = q.refs.map((_, i) => i);
    bad(q);
  });
  it('where: wrong answer index', () => {
    const q = first<WhereQ>('where');
    q.answerIndex = (q.answerIndex + 1) % 4;
    bad(q);
  });
  it('where: repeated formula pasuk', () => {
    const q = first<WhereQ>('where');
    q.book = 'Leviticus'; q.parsha = 'Vayikra'; q.ref = { book: 'Leviticus', c: 4, v: 1 };
    q.options = ['Leviticus', 'Genesis', 'Exodus', 'Numbers']; q.answerIndex = 0; q.level = 'book';
    bad(q);
  });
  it('rashi: comment attached to a different pasuk', () => {
    const q = first<RashiQ>('rashi');
    q.ref = q.options[(q.answerIndex + 1) % 4]!;
    q.answerIndex = (q.answerIndex + 1) % 4;
    bad(q);
  });
  it('rashi: altered comment text', () => {
    const q = first<RashiQ>('rashi');
    q.body = q.body + ' ועוד';
    bad(q);
  });
  it('firstlast: wrong words', () => {
    const q = first<FirstLastQ>('firstlast');
    q.options[q.answerIndex]!.text = q.options[(q.answerIndex + 1) % 4]!.text;
    bad(q);
  });
  it('duplicate ids and unknown parsha', () => {
    const q = first<ClozeQ>('cloze');
    expect(auditAll(ctx, [q, q]).some((e) => e.includes('duplicate'))).toBe(true);
    bad({ ...q, parsha: 'NotAParsha' });
  });
});
