/** XP, levels and the daily streak with a single freeze. Pure. */
import { addDays, diffDays, type DayKey } from './dates.ts';

export const XP = { correct: 10, lessonComplete: 20, perfect: 10, dailyComplete: 30, weeklyQuest: 50 };

export const LEVELS: { xp: number; he: string; en: string }[] = [
  { xp: 0, he: 'צעד ראשון', en: 'First steps' },
  { xp: 100, he: 'מתחיל', en: 'Beginner' },
  { xp: 300, he: 'לומד', en: 'Learner' },
  { xp: 700, he: 'שוקד', en: 'Diligent' },
  { xp: 1500, he: 'בקי', en: 'Well-versed' },
  { xp: 3000, he: 'מתמיד', en: 'Devoted' },
  { xp: 6000, he: 'תלמיד חכם', en: 'Talmid chacham' },
];

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.xp) i++;
  const next = LEVELS[i + 1];
  return { index: i, ...LEVELS[i]!, next: next?.xp, progress: next ? (xp - LEVELS[i]!.xp) / (next.xp - LEVELS[i]!.xp) : 1 };
}

export interface Streak { current: number; best: number; last?: DayKey; freezes: number; frozenDays: DayKey[] }
export const newStreak = (): Streak => ({ current: 0, best: 0, freezes: 1, frozenDays: [] });

/** Earn back the (single) freeze after every 7 consecutive days. */
const FREEZE_EVERY = 7;

/** Record learning activity on `today`. */
export function recordActivity(s: Streak, today: DayKey): Streak {
  if (s.last === today) return s;
  const gap = s.last ? diffDays(s.last, today) : Infinity;
  if (gap < 0) return s; // clock went backwards: ignore, never punish
  let current: number;
  let freezes = s.freezes;
  const frozenDays = [...s.frozenDays];
  if (gap === 1) current = s.current + 1;
  else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    // the missed day is covered by the freeze
    frozenDays.push(addDays(today, -1));
    current = s.current + 1;
  } else current = 1;
  if (current > 0 && current % FREEZE_EVERY === 0) freezes = Math.min(1, freezes + 1);
  return { current, best: Math.max(s.best, current), last: today, freezes, frozenDays: frozenDays.slice(-10) };
}

/** Streak as displayed on `today` (before or after today's activity). */
export function displayStreak(s: Streak, today: DayKey): number {
  if (!s.last) return 0;
  const gap = diffDays(s.last, today);
  if (gap <= 1) return s.current;
  if (gap === 2 && s.freezes > 0) return s.current; // still recoverable by the freeze
  return 0;
}
