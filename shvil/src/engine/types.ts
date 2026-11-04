/** Shared content and question types. Pure data, no DOM. */

export interface Ref { book: string; c: number; v: number }

export interface RashiComment {
  /** Dibur hamatchil (the bold lemma), without tags. May be empty. */
  dh: string;
  /** Comment body after the lemma, tags removed. */
  body: string;
}

export interface Verse {
  /** Hebrew exactly as in the Sefaria version (nikud + te'amim). */
  he: string;
  en: string;
  rashi: RashiComment[];
  rashiEn: string[];
}

export interface Parsha {
  id: string; // e.g. "Bereshit"
  title: string;
  heTitle: string;
  book: string;
  start: { c: number; v: number };
  end: { c: number; v: number };
}

export interface BookContent {
  corpus: string;
  title: string;
  heTitle: string;
  /** chapters[c-1][v-1] */
  chapters: Verse[][];
  parshiyot: Parsha[];
}

export interface ContentIndex {
  version: number;
  builtFrom: string;
  books: { title: string; heTitle: string; corpus: string; parshiyot: Parsha[]; file: string; bankFile: string; bytes: number; bankBytes: number; questionCount: number }[];
  credits: { file: string; title: string; language?: string; versionTitle?: string; versionTitleInHebrew?: string; versionSource?: string; license?: string; url: string }[];
}

export type QuestionType = 'cloze' | 'order' | 'where' | 'rashi' | 'firstlast';

interface QBase { id: string; type: QuestionType; parsha: string; book: string }

export interface ClozeQ extends QBase {
  type: 'cloze';
  ref: Ref;
  /** Index into tokenize(verse.he). */
  tokenIndex: number;
  /** Stored token text of the hidden word (exact). */
  answer: string;
  /** Token texts as stored (answer included), each with its source ref. */
  options: { text: string; ref: Ref; tokenIndex: number }[];
  answerIndex: number;
}

export interface OrderQ extends QBase {
  type: 'order';
  /** Correct order. */
  refs: Ref[];
  /** Display order: shuffled[i] is an index into refs. Never the identity. */
  shuffled: number[];
}

export type WhereLevel = 'book' | 'parsha' | 'perek';
export interface WhereQ extends QBase {
  type: 'where';
  ref: Ref;
  level: WhereLevel;
  /** Book titles, parsha ids, or chapter numbers (as strings). */
  options: string[];
  answerIndex: number;
}

export interface RashiQ extends QBase {
  type: 'rashi';
  /** Ref of the pasuk the comment is attached to. */
  ref: Ref;
  commentIndex: number;
  /** Comment body as shown (must equal the raw comment's body). */
  body: string;
  dh: string;
  options: Ref[];
  answerIndex: number;
}

export interface FirstLastQ extends QBase {
  type: 'firstlast';
  which: 'first' | 'last';
  scope: 'parsha' | 'perek';
  /** Parsha id or chapter number (as string). */
  target: string;
  /** Options are word phrases; each records the verse it was taken from. */
  options: { text: string; ref: Ref }[];
  answerIndex: number;
  nWords: number;
}

export type Question = ClozeQ | OrderQ | WhereQ | RashiQ | FirstLastQ;

export interface QuestionBank {
  book: string;
  seed: string;
  questions: Question[];
}

export const refStr = (r: Ref): string => `${r.book} ${r.c}:${r.v}`;
export const refKey = (r: Ref): string => `${r.book}.${r.c}.${r.v}`;
export const sefariaUrl = (r: Ref, commentIndex?: number): string =>
  commentIndex === undefined
    ? `https://www.sefaria.org/${r.book}.${r.c}.${r.v}?lang=bi`
    : `https://www.sefaria.org/Rashi_on_${r.book}.${r.c}.${r.v}.${commentIndex + 1}?lang=bi`;
export const sameRef = (a: Ref, b: Ref): boolean => a.book === b.book && a.c === b.c && a.v === b.v;
