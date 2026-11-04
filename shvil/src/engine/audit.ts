/**
 * Question audit. Re-validates questions against the RAW Sefaria snapshots
 * (not the processed app content), through the small RawSource interface.
 * Pure: no file system or DOM; scripts/audit-questions.ts wires it to disk.
 */
import { normalize, plainWords, tokenize } from './hebrew.ts';
import type { Question, Ref } from './types.ts';
import { refStr } from './types.ts';

export interface RawSource {
  books: string[];
  /** Raw Hebrew pasuk string, exactly as in data/raw. */
  verse(book: string, c: number, v: number): string | undefined;
  chapterCount(book: string): number;
  chapterLength(book: string, c: number): number;
  /** Raw Rashi comment HTML strings attached to a pasuk. */
  rashi(book: string, c: number, v: number): string[];
  /** Parsha ranges from the raw Sefaria index schema, in order. */
  parshiyot(book: string): { id: string; start: { c: number; v: number }; end: { c: number; v: number } }[];
}

const rawStrip = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const rawBody = (html: string) => {
  const i = html.indexOf('</b>');
  return rawStrip(html.trimStart().startsWith('<b>') && i >= 0 ? html.slice(i + 4) : html);
};
const rawDh = (html: string) => {
  const m = html.match(/^\s*<b>([\s\S]*?)<\/b>/);
  return m ? rawStrip(m[1]!) : '';
};
const vnorm = (he: string) => normalize(he.replace(/\((?:פ|ס)\)/g, ''));
const cmp = (a: { c: number; v: number }, b: { c: number; v: number }) => a.c - b.c || a.v - b.v;

export interface AuditContext {
  src: RawSource;
  verseNormSet: Map<string, number>;
}

export function makeAuditContext(src: RawSource): AuditContext {
  const verseNormSet = new Map<string, number>();
  for (const b of src.books)
    for (let c = 1; c <= src.chapterCount(b); c++)
      for (let v = 1; v <= src.chapterLength(b, c); v++) {
        const n = vnorm(src.verse(b, c, v)!);
        verseNormSet.set(n, (verseNormSet.get(n) ?? 0) + 1);
      }
  return { src, verseNormSet };
}

function nextRaw(src: RawSource, r: Ref): Ref | undefined {
  if (r.v < src.chapterLength(r.book, r.c)) return { ...r, v: r.v + 1 };
  if (r.c < src.chapterCount(r.book)) return { book: r.book, c: r.c + 1, v: 1 };
  return undefined;
}

function distance(src: RawSource, a: Ref, b: Ref): number {
  if (a.book !== b.book) return Infinity;
  const [lo, hi] = cmp(a, b) <= 0 ? [a, b] : [b, a];
  let d = 0;
  let r: Ref | undefined = lo;
  while (r && cmp(r, hi) < 0 && d < 100) { r = nextRaw(src, r); d++; }
  return d;
}

const distinctNorm = (xs: string[]) => new Set(xs.map(normalize)).size === xs.length;

/** Returns a list of violations for one question (empty = valid). */
export function auditQuestion(ctx: AuditContext, q: Question): string[] {
  const { src } = ctx;
  const errs: string[] = [];
  const fail = (m: string) => errs.push(`${q.id}: ${m}`);
  if (!src.books.includes(q.book)) return [`${q.id}: unknown book ${q.book}`];
  const ps = src.parshiyot(q.book);
  const parsha = ps.find((p) => p.id === q.parsha);
  if (!parsha) return [`${q.id}: unknown parsha ${q.parsha}`];
  const inParsha = (r: Ref) => r.book === q.book && cmp(r, parsha.start) >= 0 && cmp(r, parsha.end) <= 0;
  const exists = (r: Ref) => src.verse(r.book, r.c, r.v) !== undefined;
  const checkRef = (r: Ref, what: string) => {
    if (!exists(r)) fail(`${what} ${refStr(r)} does not exist`);
    return exists(r);
  };

  switch (q.type) {
    case 'cloze': {
      if (!checkRef(q.ref, 'ref')) break;
      if (!inParsha(q.ref)) fail(`ref ${refStr(q.ref)} not in parsha ${q.parsha}`);
      const toks = tokenize(src.verse(q.book, q.ref.c, q.ref.v)!);
      const tok = toks[q.tokenIndex];
      if (!tok || tok.text !== q.answer) fail(`answer "${q.answer}" not at token ${q.tokenIndex} of ${refStr(q.ref)}`);
      else if (tok.kind !== 'word') fail(`answer token is a ${tok.kind}, not a plain word`);
      if (q.options.length !== 4) fail(`expected 4 options, got ${q.options.length}`);
      const ans = q.options[q.answerIndex];
      if (!ans || ans.text !== q.answer || ans.tokenIndex !== q.tokenIndex || refStr(ans.ref) !== refStr(q.ref)) fail('answerIndex does not point at the answer');
      if (!distinctNorm(q.options.map((o) => o.text))) fail('options are not distinct');
      const verse = src.verse(q.book, q.ref.c, q.ref.v)!;
      q.options.forEach((o, i) => {
        if (!checkRef(o.ref, `option ${i}`)) return;
        if (tokenize(src.verse(o.ref.book, o.ref.c, o.ref.v)!)[o.tokenIndex]?.text !== o.text) fail(`option "${o.text}" not found at ${refStr(o.ref)} token ${o.tokenIndex}`);
        if (i === q.answerIndex) return;
        if (distance(src, o.ref, q.ref) > 2) fail(`distractor "${o.text}" is from ${refStr(o.ref)}, not the same or a neighbouring pasuk`);
        if (normalize(o.text) === normalize(q.answer)) fail(`distractor "${o.text}" equals the answer`);
        const t = tokenize(verse).map((x) => x.text);
        t[q.tokenIndex] = o.text;
        if (ctx.verseNormSet.has(vnorm(t.join(' ')))) fail(`distractor "${o.text}" forms a real pasuk`);
      });
      break;
    }
    case 'order': {
      if (q.refs.length < 3 || q.refs.length > 5) fail(`order needs 3-5 pesukim, got ${q.refs.length}`);
      q.refs.forEach((r, i) => {
        if (!checkRef(r, `ref ${i}`)) return;
        if (!inParsha(r)) fail(`${refStr(r)} not in parsha`);
        if (i > 0) {
          const n = nextRaw(src, q.refs[i - 1]!);
          if (!n || refStr(n) !== refStr(r)) fail(`${refStr(q.refs[i - 1]!)} → ${refStr(r)} is not consecutive`);
        }
      });
      const perm = [...q.shuffled].sort((a, b) => a - b);
      if (perm.join() !== q.refs.map((_, i) => i).join()) fail('shuffled is not a permutation');
      if (q.shuffled.every((v, i) => v === i)) fail('shuffled order equals the answer');
      const texts = q.refs.filter(exists).map((r) => vnorm(src.verse(r.book, r.c, r.v)!));
      if (new Set(texts).size !== texts.length) fail('identical pesukim make the order ambiguous');
      break;
    }
    case 'where': {
      if (!checkRef(q.ref, 'ref')) break;
      if (!inParsha(q.ref)) fail(`ref not in parsha`);
      const correct = q.level === 'book' ? q.book : q.level === 'parsha' ? ps.find((p) => cmp(q.ref, p.start) >= 0 && cmp(q.ref, p.end) <= 0)?.id : String(q.ref.c);
      if (q.options[q.answerIndex] !== correct) fail(`answer "${q.options[q.answerIndex]}" is not the correct ${q.level} "${correct}"`);
      if (new Set(q.options).size !== q.options.length) fail('options not distinct');
      if (q.options.length !== 4) fail('expected 4 options');
      const valid = q.level === 'book' ? src.books : q.level === 'parsha' ? ps.map((p) => p.id) : Array.from({ length: src.chapterCount(q.book) }, (_, i) => String(i + 1));
      for (const o of q.options) if (!valid.includes(o)) fail(`option "${o}" is not a real ${q.level}`);
      if ((ctx.verseNormSet.get(vnorm(src.verse(q.book, q.ref.c, q.ref.v)!)) ?? 0) !== 1) fail('pasuk text is not unique in the corpus');
      if (plainWords(src.verse(q.book, q.ref.c, q.ref.v)!).length < 6) fail('pasuk too short to be distinctive');
      break;
    }
    case 'rashi': {
      if (!checkRef(q.ref, 'ref')) break;
      if (!inParsha(q.ref)) fail('ref not in parsha');
      const html = src.rashi(q.book, q.ref.c, q.ref.v)[q.commentIndex];
      if (html === undefined) { fail(`no Rashi comment #${q.commentIndex + 1} on ${refStr(q.ref)}`); break; }
      if (rawBody(html) !== q.body) fail(`body differs from raw Rashi on ${refStr(q.ref)}`);
      if (rawDh(html) !== q.dh) fail(`dibur hamatchil differs from raw`);
      if (!q.options[q.answerIndex] || refStr(q.options[q.answerIndex]!) !== refStr(q.ref)) fail('answerIndex does not point at the attached pasuk');
      if (new Set(q.options.map(refStr)).size !== q.options.length) fail('options not distinct');
      q.options.forEach((o, i) => {
        if (!checkRef(o, `option ${i}`) || i === q.answerIndex) return;
        if (src.rashi(o.book, o.c, o.v).some((h) => normalize(rawBody(h)) === normalize(q.body))) fail(`distractor ${refStr(o)} carries the same comment`);
        if (vnorm(src.verse(o.book, o.c, o.v)!) === vnorm(src.verse(q.book, q.ref.c, q.ref.v)!)) fail(`distractor ${refStr(o)} has identical text`);
      });
      break;
    }
    case 'firstlast': {
      let edge: Ref | undefined;
      if (q.scope === 'parsha') {
        const p = ps.find((x) => x.id === q.target);
        if (p) edge = { book: q.book, ...(q.which === 'first' ? p.start : p.end) };
      } else {
        const c = Number(q.target);
        if (c >= 1 && c <= src.chapterCount(q.book)) edge = { book: q.book, c, v: q.which === 'first' ? 1 : src.chapterLength(q.book, c) };
      }
      if (!edge) { fail(`unknown ${q.scope} ${q.target}`); break; }
      const words = (r: Ref) => {
        const w = plainWords(src.verse(r.book, r.c, r.v) ?? '');
        return (q.which === 'first' ? w.slice(0, q.nWords) : w.slice(-q.nWords)).join(' ').replace(/׃/g, '');
      };
      const ans = q.options[q.answerIndex];
      if (!ans || refStr(ans.ref) !== refStr(edge)) fail(`answer is not from the ${q.which} pasuk ${refStr(edge)}`);
      else if (ans.text !== words(edge)) fail(`answer "${ans.text}" is not the ${q.which} ${q.nWords} words of ${refStr(edge)}`);
      if (!distinctNorm(q.options.map((o) => o.text))) fail('options not distinct');
      q.options.forEach((o, i) => {
        if (!checkRef(o.ref, `option ${i}`)) return;
        if (o.text !== words(o.ref)) fail(`option "${o.text}" is not the ${q.which} words of ${refStr(o.ref)}`);
      });
      break;
    }
    default:
      fail(`unknown type ${(q as { type: string }).type}`);
  }
  return errs;
}

export function auditAll(ctx: AuditContext, qs: Question[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const q of qs) {
    if (ids.has(q.id)) errs.push(`${q.id}: duplicate id`);
    ids.add(q.id);
    errs.push(...auditQuestion(ctx, q));
  }
  return errs;
}
