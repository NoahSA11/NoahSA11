/** Corpus-wide lookups used by generators and the audit. Pure. */
import { consonants, normalize, plainWords } from './hebrew.ts';
import { allRefs, verseAt } from './content.ts';
import type { BookContent, Ref } from './types.ts';

export interface CorpusIndex {
  books: Map<string, BookContent>;
  /** normalized verse text → number of verses with that text */
  verseCounts: Map<string, number>;
  /** consonantal 3-word shingle → number of distinct verses containing it */
  shingleCounts: Map<string, number>;
}

export const verseNorm = (he: string): string => normalize(he.replace(/\((?:פ|ס)\)/g, ''));

const shingles = (he: string): string[] => {
  const w = plainWords(he).flatMap((x) => x.split('־')).map(consonants).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 3 <= w.length; i++) out.add(w.slice(i, i + 3).join(' '));
  return [...out];
};

export function buildCorpusIndex(books: BookContent[]): CorpusIndex {
  const verseCounts = new Map<string, number>();
  const shingleCounts = new Map<string, number>();
  for (const b of books)
    for (const ch of b.chapters)
      for (const v of ch) {
        const n = verseNorm(v.he);
        verseCounts.set(n, (verseCounts.get(n) ?? 0) + 1);
        for (const s of shingles(v.he)) shingleCounts.set(s, (shingleCounts.get(s) ?? 0) + 1);
      }
  return { books: new Map(books.map((b) => [b.title, b])), verseCounts, shingleCounts };
}

export function heAt(ix: CorpusIndex, r: Ref): string | undefined {
  const b = ix.books.get(r.book);
  return b ? verseAt(b, r.c, r.v)?.he : undefined;
}

/**
 * A verse is "distinctive" (good for "Where is this from?") if it has at least
 * 6 words, its text is unique in the corpus, and fewer than a third of its
 * 3-word sequences occur in any other verse (this excludes repeated formulas
 * such as "וַיְדַבֵּר יְהוָה אֶל־מֹשֶׁה לֵּאמֹר").
 */
export function isDistinctive(ix: CorpusIndex, he: string): boolean {
  if (plainWords(he).length < 6) return false;
  if ((ix.verseCounts.get(verseNorm(he)) ?? 0) !== 1) return false;
  const sh = shingles(he);
  if (sh.length === 0) return false;
  const shared = sh.filter((s) => (ix.shingleCounts.get(s) ?? 0) > 1).length;
  return shared / sh.length < 1 / 3;
}

export { allRefs };
