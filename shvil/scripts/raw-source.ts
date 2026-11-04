/** Reads the committed raw Sefaria snapshots into the audit's RawSource interface. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORPORA } from '../content.config.ts';
import type { RawSource } from '../src/engine/audit.ts';

export const ROOT = join(import.meta.dirname, '..');

export function loadRawSource(): RawSource {
  const he = new Map<string, string[][]>();
  const rashi = new Map<string, string[][][]>();
  const parsha = new Map<string, ReturnType<RawSource['parshiyot']>>();
  for (const corpus of CORPORA)
    for (const b of corpus.books) {
      const dir = join(ROOT, 'data', 'raw', corpus.id, b.title);
      he.set(b.title, JSON.parse(readFileSync(join(dir, 'base.he.json'), 'utf8')).text);
      rashi.set(b.title, JSON.parse(readFileSync(join(dir, 'commentary.he.json'), 'utf8')).text);
      const schema = JSON.parse(readFileSync(join(dir, 'schema.json'), 'utf8'));
      parsha.set(b.title, (schema.alts?.[corpus.altStructure ?? '']?.nodes ?? []).map((n: { title: string; wholeRef: string }) => {
        const m = n.wholeRef.slice(b.title.length + 1).match(/^(\d+):(\d+)-(?:(\d+):)?(\d+)$/)!;
        return { id: n.title, start: { c: +m[1]!, v: +m[2]! }, end: { c: m[3] ? +m[3] : +m[1]!, v: +m[4]! } };
      }));
    }
  return {
    books: [...he.keys()],
    verse: (b, c, v) => he.get(b)?.[c - 1]?.[v - 1],
    chapterCount: (b) => he.get(b)?.length ?? 0,
    chapterLength: (b, c) => he.get(b)?.[c - 1]?.length ?? 0,
    rashi: (b, c, v) => (rashi.get(b)?.[c - 1]?.[v - 1] ?? []).filter((x) => typeof x === 'string' && x.trim()),
    parshiyot: (b) => parsha.get(b) ?? [],
  };
}
