/** Lazy per-book content loading (cached in memory; the service worker caches on disk). */
import type { CalendarData } from '../engine/calendar.ts';
import type { BookContent, ContentIndex, Question, QuestionBank } from '../engine/types.ts';

const BASE = './content/';
let indexP: Promise<ContentIndex> | undefined;
const books = new Map<string, Promise<BookContent>>();
const banks = new Map<string, Promise<QuestionBank>>();
let calP: Promise<CalendarData> | undefined;

async function json<T>(file: string): Promise<T> {
  const r = await fetch(BASE + file);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${file}`);
  return r.json() as Promise<T>;
}

export const loadIndex = () => (indexP ??= json<ContentIndex>('index.json'));
export async function loadBook(title: string): Promise<BookContent> {
  if (!books.has(title)) books.set(title, loadIndex().then((ix) => json<BookContent>(ix.books.find((b) => b.title === title)!.file)));
  return books.get(title)!;
}
export async function loadBank(title: string): Promise<QuestionBank> {
  if (!banks.has(title)) banks.set(title, loadIndex().then((ix) => json<QuestionBank>(ix.books.find((b) => b.title === title)!.bankFile)));
  return banks.get(title)!;
}
export const loadCalendar = () => (calP ??= json<CalendarData>('calendar.json'));

export async function questionsById(ids: string[]): Promise<Question[]> {
  const bookTitles = [...new Set(ids.map((id) => id.split(':')[0]!))];
  const all = new Map<string, Question>();
  for (const b of await Promise.all(bookTitles.map(loadBank))) for (const q of b.questions) all.set(q.id, q);
  return ids.map((id) => all.get(id)).filter((q): q is Question => !!q);
}

export async function allQuestions(): Promise<Question[]> {
  const ix = await loadIndex();
  return (await Promise.all(ix.books.map((b) => loadBank(b.title)))).flatMap((b) => b.questions);
}
