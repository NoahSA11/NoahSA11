/** "First / last words" of a parsha or perek. */
import { normalize, plainWords } from '../hebrew.ts';
import { cmpRef, verseAt } from '../content.ts';
import type { Rng } from '../prng.ts';
import type { BookContent, FirstLastQ, Parsha, Ref } from '../types.ts';

export const stripSofPasuq = (s: string): string => s.replace(/׃/g, '');

export function edgeWords(he: string, which: 'first' | 'last', n: number): string | undefined {
  const w = plainWords(he);
  if (w.length < n) return undefined;
  return stripSofPasuq((which === 'first' ? w.slice(0, n) : w.slice(-n)).join(' '));
}

interface Unit { key: string; first: Ref; last: Ref }

const unitsFor = (b: BookContent, scope: 'parsha' | 'perek'): Unit[] =>
  scope === 'parsha'
    ? b.parshiyot.map((p) => ({ key: p.id, first: { book: b.title, ...p.start }, last: { book: b.title, ...p.end } }))
    : b.chapters.map((ch, i) => ({ key: String(i + 1), first: { book: b.title, c: i + 1, v: 1 }, last: { book: b.title, c: i + 1, v: ch.length } }));

export function makeFirstLast(b: BookContent, p: Parsha, scope: 'parsha' | 'perek', which: 'first' | 'last', key: string, r: Rng, id: string): FirstLastQ | undefined {
  const units = unitsFor(b, scope);
  const ui = units.findIndex((u) => u.key === key);
  const u = units[ui];
  if (!u) return undefined;
  const others = units.filter((_, j) => j !== ui && Math.abs(j - ui) <= 6);
  const refOf = (x: Unit) => (which === 'first' ? x.first : x.last);
  for (let n = 3; n <= 6; n++) {
    const ans = edgeWords(verseAt(b, refOf(u).c, refOf(u).v)!.he, which, n);
    if (!ans) return undefined;
    const ansN = normalize(ans);
    const seen = new Set([ansN]);
    const pool: { text: string; ref: Ref }[] = [];
    for (const o of others) {
      const t = edgeWords(verseAt(b, refOf(o).c, refOf(o).v)!.he, which, n);
      if (!t || seen.has(normalize(t))) continue;
      seen.add(normalize(t));
      pool.push({ text: t, ref: refOf(o) });
    }
    if (pool.length < 3) continue;
    const options = r.shuffle([{ text: ans, ref: refOf(u) }, ...r.sample(pool, 3)]);
    return {
      id, type: 'firstlast', parsha: p.id, book: b.title, which, scope, target: key, nWords: n,
      options, answerIndex: options.findIndex((o) => cmpRef(o.ref, refOf(u)) === 0),
    };
  }
  return undefined;
}
