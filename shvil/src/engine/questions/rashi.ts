/** "Rashi match": a real Rashi comment; choose the pasuk it is attached to. */
import { normalize } from '../hebrew.ts';
import { parshaRefs, verseAt } from '../content.ts';
import { verseNorm } from '../corpus-index.ts';
import type { Rng } from '../prng.ts';
import type { BookContent, Parsha, Ref, RashiQ } from '../types.ts';

export function makeRashi(b: BookContent, p: Parsha, ref: Ref, commentIndex: number, r: Rng, id: string): RashiQ | undefined {
  const v = verseAt(b, ref.c, ref.v);
  const cm = v?.rashi[commentIndex];
  if (!v || !cm) return undefined;
  if (cm.body.length < 40 || cm.body.length > 420) return undefined;
  const bodyN = normalize(cm.body);
  const refs = parshaRefs(b, p);
  const i = refs.findIndex((x) => x.c === ref.c && x.v === ref.v);
  const pool = refs.filter((x, j) => {
    if (j === i || Math.abs(j - i) > 12) return false;
    const xv = verseAt(b, x.c, x.v)!;
    if (verseNorm(xv.he) === verseNorm(v.he)) return false;
    // A distractor pasuk must not carry the same comment.
    return !xv.rashi.some((c) => normalize(c.body) === bodyN);
  });
  if (pool.length < 3) return undefined;
  const options = r.shuffle([ref, ...r.sample(pool, 3)]);
  return { id, type: 'rashi', parsha: p.id, book: b.title, ref, commentIndex, body: cm.body, dh: cm.dh, options, answerIndex: options.indexOf(ref) };
}
