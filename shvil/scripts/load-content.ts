/** Raw Sefaria snapshot → BookContent (used by build-content and tests). */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPORA } from '../content.config.ts';
import type { BookContent, Parsha, RashiComment, Verse } from '../src/engine/types.ts';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'data', 'raw');

export const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&thinsp;': ' ' };
export const stripTags = (s: string): string =>
  s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? ' ').replace(/\s+/g, ' ').trim();

/** Split a Rashi comment into its bold lemma (dibur hamatchil) and body. */
export function splitRashi(html: string): RashiComment {
  const m = html.match(/^\s*<b>([\s\S]*?)<\/b>([\s\S]*)$/);
  if (!m) return { dh: '', body: stripTags(html) };
  return { dh: stripTags(m[1]!), body: stripTags(m[2]!) };
}

export function parseRange(wholeRef: string, book: string): { start: { c: number; v: number }; end: { c: number; v: number } } {
  const rest = wholeRef.slice(book.length + 1);
  let m = rest.match(/^(\d+):(\d+)-(\d+):(\d+)$/);
  if (m) return { start: { c: +m[1]!, v: +m[2]! }, end: { c: +m[3]!, v: +m[4]! } };
  m = rest.match(/^(\d+):(\d+)-(\d+)$/);
  if (m) return { start: { c: +m[1]!, v: +m[2]! }, end: { c: +m[1]!, v: +m[3]! } };
  throw new Error(`Cannot parse range ${wholeRef}`);
}

export function loadBook(corpus: string, title: string, heTitle: string, alt: string | undefined): BookContent {
  const dir = join(RAW, corpus, title);
  const he: string[][] = readJson(join(dir, 'base.he.json')).text;
  const en: string[][] = readJson(join(dir, 'translation.en.json')).text;
  const rh: string[][][] = readJson(join(dir, 'commentary.he.json')).text;
  const re: string[][][] = readJson(join(dir, 'commentary.en.json')).text;
  if (he.length !== en.length) throw new Error(`${title}: chapter count mismatch he/en`);
  const chapters: Verse[][] = he.map((ch, ci) => {
    if (ch.length !== en[ci]!.length) throw new Error(`${title} ${ci + 1}: verse count mismatch he/en`);
    return ch.map((v, vi) => ({
      he: v,
      en: stripTags(en[ci]![vi] ?? ''),
      rashi: (rh[ci]?.[vi] ?? []).filter((x) => typeof x === 'string' && x.trim()).map(splitRashi),
      rashiEn: (re[ci]?.[vi] ?? []).filter((x) => typeof x === 'string' && x.trim()).map(stripTags),
    }));
  });
  const parshiyot: Parsha[] = [];
  if (alt) {
    const schema = readJson(join(dir, 'schema.json'));
    for (const node of schema.alts[alt].nodes) {
      parshiyot.push({ id: node.title, title: node.title, heTitle: node.heTitle, book: title, ...parseRange(node.wholeRef, title) });
    }
    // Parshiyot must tile the book exactly.
    let expect = { c: 1, v: 1 };
    for (const p of parshiyot) {
      if (p.start.c !== expect.c || p.start.v !== expect.v) throw new Error(`${title}: gap before ${p.id}`);
      expect = p.end.v < chapters[p.end.c - 1]!.length ? { c: p.end.c, v: p.end.v + 1 } : { c: p.end.c + 1, v: 1 };
    }
    if (expect.c !== chapters.length + 1) throw new Error(`${title}: parshiyot do not reach the end`);
  }
  return { corpus, title, heTitle, chapters, parshiyot };
}

export function loadAllBooks(only?: string[]): BookContent[] {
  const out: BookContent[] = [];
  for (const corpus of CORPORA)
    for (const b of corpus.books) if (!only || only.includes(b.title)) out.push(loadBook(corpus.id, b.title, b.heTitle, corpus.altStructure));
  return out;
}
