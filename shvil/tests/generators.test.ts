import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllBooks } from '../scripts/load-content.ts';
import { loadRawSource } from '../scripts/raw-source.ts';
import { auditAll, auditQuestion, makeAuditContext } from '../src/engine/audit.ts';
import { buildCorpusIndex, isDistinctive, type CorpusIndex } from '../src/engine/corpus-index.ts';
import { consonants, normalize, plainWords, tokenize } from '../src/engine/hebrew.ts';
import { rng } from '../src/engine/prng.ts';
import { bookBank, parshaQuestions } from '../src/engine/questions/bank.ts';
import { makeCloze } from '../src/engine/questions/cloze.ts';
import { makeFirstLast } from '../src/engine/questions/firstlast.ts';
import { makeOrder } from '../src/engine/questions/order.ts';
import { makeRashi } from '../src/engine/questions/rashi.ts';
import { makeWhere } from '../src/engine/questions/where.ts';
import type { BookContent, Parsha, Verse } from '../src/engine/types.ts';

let books: BookContent[];
let ix: CorpusIndex;
let gen: BookContent;
const ctx = makeAuditContext(loadRawSource());
beforeAll(() => {
  books = loadAllBooks();
  ix = buildCorpusIndex(books);
  gen = books[0]!;
});
const P = (id: string, b = gen) => b.parshiyot.find((p) => p.id === id)!;

/** A tiny synthetic book for adversarial cases. */
function synth(verses: string[]): { b: BookContent; p: Parsha } {
  const v: Verse[] = verses.map((he) => ({ he, en: '', rashi: [], rashiEn: [] }));
  const p: Parsha = { id: 'T', title: 'T', heTitle: 'ט', book: 'Synth', start: { c: 1, v: 1 }, end: { c: 1, v: v.length } };
  return { b: { corpus: 't', title: 'Synth', heTitle: 'ט', chapters: [v], parshiyot: [p] }, p };
}

describe('determinism', () => {
  it('same seed → identical bank', () => {
    expect(parshaQuestions(gen, P('Noach'), ix)).toEqual(parshaQuestions(gen, P('Noach'), ix));
  });
  it('generates all five types for every parsha in Genesis', () => {
    for (const p of gen.parshiyot) {
      const types = new Set(parshaQuestions(gen, p, ix).map((q) => q.type));
      expect([...types].sort()).toEqual(['cloze', 'firstlast', 'order', 'rashi', 'where']);
    }
  });
});

describe('cloze', () => {
  it('never hides ketiv, qere, markers or divine names', () => {
    for (const q of bookBank(gen, ix).questions) {
      if (q.type !== 'cloze') continue;
      const t = tokenize(gen.chapters[q.ref.c - 1]![q.ref.v - 1]!.he)[q.tokenIndex]!;
      expect(t.kind).toBe('word');
      expect(/[[\]()]/.test(t.text)).toBe(false);
    }
  });
  it('rejects very short pesukim', () => {
    const { b, p } = synth(['וַיֹּאמַר׃', 'שְׁמַע יִשְׂרָאֵל׃']);
    expect(makeCloze(b, p, { book: 'Synth', c: 1, v: 1 }, ix, rng(1), 'x')).toBeUndefined();
  });
  it('repeated phrases: a distractor never has the same normalized form as the answer', () => {
    const rep = 'וַיֹּאמֶר מֹשֶׁה אֶל הָעָם וַיֹּאמֶר מֹשֶׁה אֶל הָעָם׃';
    const { b, p } = synth([rep, rep, 'וַיֵּלֶךְ הָעָם אֶל הָהָר הַגָּדוֹל׃', 'וַיַּעַן כָּל הָעָם יַחְדָּו׃']);
    for (let s = 0; s < 30; s++) {
      const q = makeCloze(b, p, { book: 'Synth', c: 1, v: 1 }, ix, rng(s), 'x');
      if (!q) continue;
      const ans = normalize(q.answer);
      q.options.forEach((o, i) => { if (i !== q.answerIndex) expect(normalize(o.text)).not.toBe(ans); });
    }
  });
  it('ketiv/qere pasuk (Genesis 8:17) still yields a valid, audited question', () => {
    let ok = 0;
    for (let s = 0; s < 20; s++) {
      const q = makeCloze(gen, P('Noach'), { book: 'Genesis', c: 8, v: 17 }, ix, rng(s), `Genesis:Noach:cloze:t${s}`);
      if (q) { expect(auditQuestion(ctx, q)).toEqual([]); ok++; }
    }
    expect(ok).toBeGreaterThan(0);
  });
});

describe('order', () => {
  it('refuses windows containing identical pesukim', () => {
    const { b, p } = synth(['אֶחָד שְׁנַיִם שְׁלֹשָׁה׃', 'אַרְבַּע חָמֵשׁ׃', 'אֶחָד שְׁנַיִם שְׁלֹשָׁה׃']);
    expect(makeOrder(b, p, 0, 3, rng(1), 'x')).toBeUndefined();
  });
  it('shuffled is never the identity', () => {
    for (let s = 0; s < 50; s++) {
      const q = makeOrder(gen, P('Bereshit'), 0, 3, rng(s), 'x')!;
      expect(q.shuffled.every((v, i) => v === i)).toBe(false);
    }
  });
});

describe('where', () => {
  it('excludes repeated formulas', () => {
    // "וַיְדַבֵּר יְהוָה אֶל־מֹשֶׁה לֵּאמֹר" appears dozens of times
    expect(isDistinctive(ix, books[2]!.chapters[3]![0]!.he)).toBe(false);
    expect(makeWhere(books[2]!, P('Vayikra', books[2]!), { book: 'Leviticus', c: 4, v: 1 }, 'book', ix, rng(1), 'x')).toBeUndefined();
  });
  it('accepts a distinctive pasuk (Genesis 1:1)', () => {
    expect(isDistinctive(ix, gen.chapters[0]![0]!.he)).toBe(true);
  });
});

describe('rashi & firstlast', () => {
  it('rashi answer is the pasuk the comment is attached to', () => {
    const q = makeRashi(gen, P('Bereshit'), { book: 'Genesis', c: 1, v: 1 }, 0, rng(3), 'Genesis:Bereshit:rashi:t');
    if (q) {
      expect(q.options[q.answerIndex]).toEqual({ book: 'Genesis', c: 1, v: 1 });
      expect(auditQuestion(ctx, q)).toEqual([]);
    }
  });
  it('first words of Bereshit are בראשית ברא אלהים', () => {
    const q = makeFirstLast(gen, P('Bereshit'), 'parsha', 'first', 'Bereshit', rng(1), 'Genesis:Bereshit:firstlast:t')!;
    expect(q.options[q.answerIndex]!.text).toBe(plainWords(gen.chapters[0]![0]!.he).slice(0, 3).join(' '));
    expect(consonants(q.options[q.answerIndex]!.text)).toBe('בראשיתבראאלהים');
    expect(auditQuestion(ctx, q)).toEqual([]);
  });
});

describe('generated banks pass the audit', () => {
  it('Genesis bank: 0 violations', () => {
    expect(auditAll(ctx, bookBank(gen, ix).questions)).toEqual([]);
  });
});
