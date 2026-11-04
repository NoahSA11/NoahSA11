/** Navigation helpers over BookContent. Pure. */
import type { BookContent, Parsha, Ref, Verse } from './types.ts';

export const verseAt = (b: BookContent, c: number, v: number): Verse | undefined => b.chapters[c - 1]?.[v - 1];

export function nextRef(b: BookContent, r: Ref): Ref | undefined {
  if (verseAt(b, r.c, r.v + 1)) return { book: r.book, c: r.c, v: r.v + 1 };
  if (verseAt(b, r.c + 1, 1)) return { book: r.book, c: r.c + 1, v: 1 };
  return undefined;
}
export function prevRef(b: BookContent, r: Ref): Ref | undefined {
  if (r.v > 1) return { book: r.book, c: r.c, v: r.v - 1 };
  const prevCh = b.chapters[r.c - 2];
  if (prevCh) return { book: r.book, c: r.c - 1, v: prevCh.length };
  return undefined;
}

export const cmpRef = (a: { c: number; v: number }, b: { c: number; v: number }): number => a.c - b.c || a.v - b.v;

/** All refs of a parsha, in order. */
export function parshaRefs(b: BookContent, p: Parsha): Ref[] {
  const out: Ref[] = [];
  let r: Ref | undefined = { book: b.title, c: p.start.c, v: p.start.v };
  while (r && cmpRef(r, p.end) <= 0) {
    out.push(r);
    r = nextRef(b, r);
  }
  return out;
}

export function parshaOf(b: BookContent, r: Ref): Parsha | undefined {
  return b.parshiyot.find((p) => cmpRef(r, p.start) >= 0 && cmpRef(r, p.end) <= 0);
}

export function allRefs(b: BookContent): Ref[] {
  const out: Ref[] = [];
  b.chapters.forEach((ch, ci) => ch.forEach((_, vi) => out.push({ book: b.title, c: ci + 1, v: vi + 1 })));
  return out;
}
