/** Deterministic question-bank generation for a whole book. */
import { parshaRefs, verseAt } from '../content.ts';
import type { CorpusIndex } from '../corpus-index.ts';
import { rng } from '../prng.ts';
import type { BookContent, Parsha, Question, QuestionBank, WhereLevel } from '../types.ts';
import { makeCloze } from './cloze.ts';
import { makeFirstLast } from './firstlast.ts';
import { makeOrder } from './order.ts';
import { makeRashi } from './rashi.ts';
import { makeWhere } from './where.ts';

export const BANK_SEED = 'shvil-bank-v1';
export const LIMITS = { cloze: 36, order: 8, where: 12, rashi: 14, firstlast: 6 };

/** Evenly spread k picks over n items (deterministic, then jittered by rng). */
function spread<T>(items: T[], k: number, jitter: () => number): T[] {
  if (items.length <= k) return items;
  const step = items.length / k;
  return Array.from({ length: k }, (_, i) => items[Math.min(items.length - 1, Math.floor(i * step + jitter() * step))]!);
}

export function parshaQuestions(b: BookContent, p: Parsha, ix: CorpusIndex, seed = BANK_SEED): Question[] {
  const r = rng(`${seed}:${b.title}:${p.id}`);
  const refs = parshaRefs(b, p);
  const out: Question[] = [];
  const pre = `${b.title}:${p.id}`;

  let n = 0;
  for (const ref of spread(refs, LIMITS.cloze, r.next)) {
    const q = makeCloze(b, p, ref, ix, r, `${pre}:cloze:${n}`);
    if (q) { out.push(q); n++; }
  }

  n = 0;
  const ks = [3, 4, 5];
  for (const start of spread(refs.map((_, i) => i), LIMITS.order * 2, r.next)) {
    if (n >= LIMITS.order) break;
    const q = makeOrder(b, p, start, ks[n % 3]!, r, `${pre}:order:${n}`);
    if (q) { out.push(q); n++; }
  }

  n = 0;
  const levels: WhereLevel[] = ['book', 'parsha', 'perek'];
  for (const ref of r.shuffle(refs)) {
    if (n >= LIMITS.where) break;
    const q = makeWhere(b, p, ref, levels[n % 3]!, ix, r, `${pre}:where:${n}`);
    if (q) { out.push(q); n++; }
  }

  n = 0;
  const comments = refs.flatMap((ref) => verseAt(b, ref.c, ref.v)!.rashi.map((_, ci) => ({ ref, ci })));
  for (const { ref, ci } of r.shuffle(comments)) {
    if (n >= LIMITS.rashi) break;
    const q = makeRashi(b, p, ref, ci, r, `${pre}:rashi:${n}`);
    if (q) { out.push(q); n++; }
  }

  n = 0;
  const fl: [('parsha' | 'perek'), ('first' | 'last'), string][] = [
    ['parsha', 'first', p.id],
    ['parsha', 'last', p.id],
  ];
  for (const ref of refs) if (ref.v === 1) fl.push(['perek', 'first', String(ref.c)], ['perek', 'last', String(ref.c)]);
  for (const [scope, which, key] of fl) {
    if (n >= LIMITS.firstlast) break;
    const q = makeFirstLast(b, p, scope, which, key, r, `${pre}:firstlast:${n}`);
    if (q) { out.push(q); n++; }
  }
  return out;
}

export function bookBank(b: BookContent, ix: CorpusIndex, seed = BANK_SEED): QuestionBank {
  return { book: b.title, seed, questions: b.parshiyot.flatMap((p) => parshaQuestions(b, p, ix, seed)) };
}
