/** Daily challenge, lessons, review and placement composition. Pure and seeded. */
import type { DayKey } from './dates.ts';
import { rng, type Rng } from './prng.ts';
import { dueItems, type SrsItem } from './spaced-repetition.ts';
import type { Question, QuestionType } from './types.ts';

export const DAILY_SIZE = 10;
export const LESSON_SIZE = 10;
export const DAILY_PATTERN: QuestionType[] = ['cloze', 'where', 'rashi', 'order', 'cloze', 'firstlast', 'where', 'cloze', 'rashi', 'order'];
const LESSON_PATTERN: QuestionType[] = ['cloze', 'cloze', 'order', 'rashi', 'cloze', 'where', 'firstlast', 'cloze', 'rashi', 'order'];

export const dailySeed = (day: DayKey): string => `shvil-daily:${day}`;

function byPattern(pool: Question[], pattern: QuestionType[], r: Rng, prefer?: (q: Question) => number): Question[] {
  const used = new Set<string>();
  const out: Question[] = [];
  for (const t of pattern) {
    let cands = pool.filter((q) => q.type === t && !used.has(q.id));
    if (!cands.length) cands = pool.filter((q) => !used.has(q.id));
    if (!cands.length) break;
    cands = r.shuffle(cands);
    if (prefer) cands.sort((a, b) => prefer(a) - prefer(b));
    const q = cands[0]!;
    used.add(q.id);
    out.push(q);
  }
  return out;
}

/** 10 mixed questions, identical for everyone on the same local date. */
export function dailyQuestions(allBanks: Question[], day: DayKey): Question[] {
  const r = rng(dailySeed(day));
  const sorted = [...allBanks].sort((a, b) => a.id.localeCompare(b.id));
  return byPattern(sorted, DAILY_PATTERN, r);
}

/** A parsha lesson: new items first, then due, then the rest (seeded by attempt). */
export function lessonQuestions(parshaBank: Question[], srs: Record<string, SrsItem>, today: DayKey, seed: string): Question[] {
  const r = rng(seed);
  const rank = (q: Question) => {
    const it = srs[q.id];
    if (!it) return 0;
    return it.due <= today ? 1 : 2 + it.box;
  };
  return byPattern(parshaBank, LESSON_PATTERN, r, rank);
}

export function placementQuestions(parshaBank: Question[], seed: string): Question[] {
  return byPattern(parshaBank, ['cloze', 'where', 'cloze', 'order', 'rashi', 'cloze', 'firstlast', 'cloze'], rng(seed));
}
export const PLACEMENT_PASS = 6; // of 8

export function reviewIds(srs: Record<string, SrsItem>, today: DayKey, limit = 12): string[] {
  return dueItems(srs, today, limit);
}

/** Book of a question id ("Genesis:Bereshit:cloze:3"). */
export const bookOfId = (id: string): string => id.split(':')[0]!;
export const parshaOfId = (id: string): string => id.split(':')[1]!;
