/**
 * Leitner-box spaced repetition. Box 0 = new. A correct answer moves an item up
 * one box and schedules it after that box's interval; a wrong answer sends it
 * back to box 1, due the same day (so it appears in today's Review).
 */
import { addDays, diffDays, type DayKey } from './dates.ts';

export const INTERVALS = [0, 1, 2, 4, 8, 16, 32] as const; // days, by box
export const MAX_BOX = INTERVALS.length - 1;

export interface SrsItem { box: number; due: DayKey; seen: number; correct: number; last: DayKey }

export function schedule(prev: SrsItem | undefined, correct: boolean, today: DayKey): SrsItem {
  const p = prev ?? { box: 0, due: today, seen: 0, correct: 0, last: today };
  const box = correct ? Math.min(MAX_BOX, p.box + 1) : 1;
  return { box, due: correct ? addDays(today, INTERVALS[box]!) : today, seen: p.seen + 1, correct: p.correct + (correct ? 1 : 0), last: today };
}

export const isDue = (it: SrsItem, today: DayKey): boolean => diffDays(it.due, today) >= 0;

/** Due item ids, most overdue first, then lowest box; stable by id. */
export function dueItems(items: Record<string, SrsItem>, today: DayKey, limit = Infinity): string[] {
  return Object.entries(items)
    .filter(([, it]) => isDue(it, today))
    .sort(([a, x], [b, y]) => diffDays(y.due, x.due) || x.box - y.box || a.localeCompare(b))
    .slice(0, limit)
    .map(([id]) => id);
}

/** Mastery of a set of items in [0,1]: average box (capped at 4) over the set. */
export function mastery(ids: string[], items: Record<string, SrsItem>): number {
  if (!ids.length) return 0;
  return ids.reduce((s, id) => s + Math.min(4, items[id]?.box ?? 0), 0) / (4 * ids.length);
}
