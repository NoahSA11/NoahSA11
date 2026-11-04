/** "Finish the pasuk": hide one word; distractors from the same or neighbouring pesukim. */
import { consonants, isDivineName, normalize, tokenize } from '../hebrew.ts';
import { nextRef, prevRef, verseAt } from '../content.ts';
import { verseNorm, type CorpusIndex } from '../corpus-index.ts';
import type { Rng } from '../prng.ts';
import type { BookContent, ClozeQ, Parsha, Ref } from '../types.ts';

export const clozeWordOk = (text: string): boolean =>
  consonants(text).length >= 2 && !isDivineName(text) && !text.includes('־');

/** Verse text with token i replaced (used to verify a distractor does not form a real pasuk). */
export function substituteToken(he: string, i: number, replacement: string): string {
  const toks = tokenize(he).map((t) => t.text);
  toks[i] = replacement;
  return toks.join(' ');
}

export function makeCloze(b: BookContent, p: Parsha, ref: Ref, ix: CorpusIndex, r: Rng, id: string): ClozeQ | undefined {
  const verse = verseAt(b, ref.c, ref.v);
  if (!verse) return undefined;
  const toks = tokenize(verse.he);
  const candidates = toks
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.kind === 'word' && clozeWordOk(t.text));
  if (toks.filter((t) => t.kind === 'word').length < 4 || candidates.length === 0) return undefined;
  const target = r.pick(candidates);
  const ansNorm = normalize(target.t.text);

  // Distractor pool: neighbouring pesukim (±1, ±2) first, the same pasuk last
  // (its other words are visible in the prompt, so they make weaker distractors).
  const near: Ref[] = [];
  let a: Ref | undefined = ref, z: Ref | undefined = ref;
  for (let k = 0; k < 2; k++) {
    a = a && prevRef(b, a);
    z = z && nextRef(b, z);
    if (a) near.push(a);
    if (z) near.push(z);
  }
  const seen = new Set([ansNorm]);
  const pool: { text: string; ref: Ref; tokenIndex: number }[] = [];
  for (const nr of near) {
    const nv = verseAt(b, nr.c, nr.v)!;
    const ntoks = tokenize(nv.he);
    const local = r.shuffle(ntoks.map((t, i) => ({ t, i })).filter(({ t }) => t.kind === 'word' && clozeWordOk(t.text)));
    for (const { t, i } of local) {
      const n = normalize(t.text);
      if (seen.has(n)) continue;
      // Verified not to fit: substituting must not yield any real pasuk in the corpus.
      if (ix.verseCounts.has(verseNorm(substituteToken(verse.he, target.i, t.text)))) continue;
      seen.add(n);
      pool.push({ text: t.text, ref: nr, tokenIndex: i });
    }
  }
  if (pool.length < 3) return undefined;
  const chosen = r.sample(pool.slice(0, 5), 3);
  const options = r.shuffle([{ text: target.t.text, ref, tokenIndex: target.i }, ...chosen]);
  return {
    id, type: 'cloze', parsha: p.id, book: b.title, ref,
    tokenIndex: target.i, answer: target.t.text,
    options, answerIndex: options.findIndex((o) => o.tokenIndex === target.i && o.ref === ref),
  };
}
