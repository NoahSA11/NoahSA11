/** "Where is this from?": book / parsha / perek, using distinctive pesukim only. */
import { verseAt } from '../content.ts';
import { isDistinctive, type CorpusIndex } from '../corpus-index.ts';
import type { Rng } from '../prng.ts';
import type { BookContent, Parsha, Ref, WhereLevel, WhereQ } from '../types.ts';

export const BOOK_ORDER = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];

export function makeWhere(b: BookContent, p: Parsha, ref: Ref, level: WhereLevel, ix: CorpusIndex, r: Rng, id: string): WhereQ | undefined {
  const v = verseAt(b, ref.c, ref.v);
  if (!v || !isDistinctive(ix, v.he)) return undefined;
  let answer: string;
  let pool: string[];
  if (level === 'book') {
    answer = b.title;
    pool = [...ix.books.keys()].filter((t) => t !== answer);
  } else if (level === 'parsha') {
    answer = p.id;
    const i = b.parshiyot.findIndex((x) => x.id === p.id);
    pool = b.parshiyot.filter((_, j) => j !== i && Math.abs(j - i) <= 4).map((x) => x.id);
  } else {
    answer = String(ref.c);
    pool = b.chapters.map((_, j) => String(j + 1)).filter((c) => c !== answer && Math.abs(Number(c) - ref.c) <= 6);
  }
  if (pool.length < 3) return undefined;
  const options = r.shuffle([answer, ...r.sample(pool, 3)]);
  return { id, type: 'where', parsha: p.id, book: b.title, ref, level, options, answerIndex: options.indexOf(answer) };
}
