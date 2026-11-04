/** "Order the pesukim": 3–5 consecutive pesukim, shuffled. */
import { parshaRefs, verseAt } from '../content.ts';
import { verseNorm } from '../corpus-index.ts';
import type { Rng } from '../prng.ts';
import type { BookContent, OrderQ, Parsha } from '../types.ts';

export function makeOrder(b: BookContent, p: Parsha, start: number, k: number, r: Rng, id: string): OrderQ | undefined {
  const refs = parshaRefs(b, p).slice(start, start + k);
  if (refs.length !== k) return undefined;
  const texts = refs.map((x) => verseNorm(verseAt(b, x.c, x.v)!.he));
  if (new Set(texts).size !== k) return undefined; // identical pesukim would make order ambiguous
  if (texts.some((t) => t.split(' ').length > 40)) return undefined; // keep cards readable
  let shuffled = r.shuffle(refs.map((_, i) => i));
  for (let tries = 0; shuffled.every((v, i) => v === i) && tries < 10; tries++) shuffled = r.shuffle(shuffled);
  if (shuffled.every((v, i) => v === i)) shuffled = [...shuffled.slice(1), shuffled[0]!];
  return { id, type: 'order', parsha: p.id, book: b.title, refs, shuffled };
}
