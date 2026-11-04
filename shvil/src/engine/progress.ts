/**
 * Versioned local progress schema, migrations, and JSON import/export.
 * Pure: serialization only; the UI layer owns localStorage (with try/catch).
 */
import type { DayKey } from './dates.ts';
import type { SrsItem } from './spaced-repetition.ts';
import { newStreak, type Streak } from './xp-streak.ts';

export const SCHEMA = 2;
export const STORAGE_KEY = 'shvil.progress';

export interface Settings {
  uiLang: 'he' | 'en';
  cantillation: boolean;
  divineNames: 'written' | 'substituted';
  showTranslation: boolean;
  calendar: 'il' | 'diaspora';
}

export interface ParshaProgress { completed: number; best: number; lastPlayed?: DayKey }

export interface ActiveLesson {
  kind: 'lesson' | 'review' | 'daily' | 'placement';
  key: string; // parsha id, day key, …
  book?: string;
  questionIds: string[];
  index: number;
  hearts: number;
  results: (boolean | null)[];
  learnSeen: boolean;
  /** Answer currently selected for questions[index], if feedback is showing. */
  pending?: { answer: number[]; correct: boolean };
  startedAt: DayKey;
}

export interface Progress {
  schema: typeof SCHEMA;
  xp: number;
  streak: Streak;
  srs: Record<string, SrsItem>;
  parshiyot: Record<string, ParshaProgress>;
  /** Highest unlocked parsha index per book (0 = first). */
  unlocked: Record<string, number>;
  daily: Record<DayKey, { score: number; total: number; results: boolean[] }>;
  weekly: Record<string, boolean>;
  settings: Settings;
  active?: ActiveLesson;
}

export const defaultSettings = (): Settings => ({ uiLang: 'he', cantillation: false, divineNames: 'written', showTranslation: true, calendar: 'il' });

export const newProgress = (): Progress => ({
  schema: SCHEMA, xp: 0, streak: newStreak(), srs: {}, parshiyot: {}, unlocked: {}, daily: {}, weekly: {}, settings: defaultSettings(),
});

/** Schema v1 (first prototype): flat streak, list of completed parsha ids, Leitner boxes only. */
export interface ProgressV1 {
  schema: 1;
  xp: number;
  streakCount: number;
  lastDay?: DayKey;
  completed: string[];
  boxes: Record<string, { box: number; due: DayKey }>;
  lang?: 'he' | 'en';
}

type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
export const MIGRATIONS: Record<number, Migration> = {
  1: (o) => {
    const v1 = o as unknown as ProgressV1;
    const p = newProgress();
    p.xp = num(v1.xp);
    p.streak = { ...newStreak(), current: num(v1.streakCount), best: num(v1.streakCount), last: isDay(v1.lastDay) ? v1.lastDay : undefined };
    for (const id of Array.isArray(v1.completed) ? v1.completed : []) if (typeof id === 'string') p.parshiyot[id] = { completed: 1, best: 0 };
    for (const [id, b] of Object.entries(v1.boxes ?? {}))
      if (b && isDay(b.due)) p.srs[id] = { box: clamp(num(b.box), 0, 6), due: b.due, seen: 1, correct: 0, last: b.due };
    if (v1.lang === 'en' || v1.lang === 'he') p.settings.uiLang = v1.lang;
    return p as unknown as Record<string, unknown>;
  },
};

const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const isDay = (x: unknown): x is DayKey => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** Bring any older object up to the current schema and sanitize it. Throws on unusable input. */
export function migrate(input: unknown): Progress {
  if (!isObj(input)) throw new Error('progress is not an object');
  let o = input;
  let v = num(o.schema, NaN);
  if (!Number.isInteger(v) || v < 1) throw new Error('missing schema version');
  if (v > SCHEMA) throw new Error(`progress is from a newer version (schema ${v})`);
  while (v < SCHEMA) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`no migration from schema ${v}`);
    o = m(o);
    v = num(o.schema);
  }
  return sanitize(o);
}

function sanitize(o: Record<string, unknown>): Progress {
  const p = newProgress();
  p.xp = Math.max(0, num(o.xp));
  if (isObj(o.streak)) {
    const s = o.streak;
    p.streak = { current: Math.max(0, num(s.current)), best: Math.max(0, num(s.best)), last: isDay(s.last) ? s.last : undefined, freezes: clamp(num(s.freezes, 1), 0, 1), frozenDays: Array.isArray(s.frozenDays) ? s.frozenDays.filter(isDay) : [] };
  }
  if (isObj(o.srs)) for (const [k, it] of Object.entries(o.srs)) if (isObj(it) && isDay(it.due)) p.srs[k] = { box: clamp(num(it.box), 0, 6), due: it.due, seen: num(it.seen), correct: num(it.correct), last: isDay(it.last) ? it.last : it.due };
  if (isObj(o.parshiyot)) for (const [k, it] of Object.entries(o.parshiyot)) if (isObj(it)) p.parshiyot[k] = { completed: num(it.completed), best: clamp(num(it.best), 0, 1), lastPlayed: isDay(it.lastPlayed) ? it.lastPlayed : undefined };
  if (isObj(o.unlocked)) for (const [k, it] of Object.entries(o.unlocked)) p.unlocked[k] = Math.max(0, Math.floor(num(it)));
  if (isObj(o.daily)) for (const [k, it] of Object.entries(o.daily)) if (isDay(k) && isObj(it) && Array.isArray(it.results)) p.daily[k] = { score: num(it.score), total: num(it.total), results: it.results.map(Boolean) };
  if (isObj(o.weekly)) for (const [k, it] of Object.entries(o.weekly)) p.weekly[k] = !!it;
  if (isObj(o.settings)) {
    const s = o.settings;
    p.settings = {
      uiLang: s.uiLang === 'en' ? 'en' : 'he',
      cantillation: s.cantillation === true,
      divineNames: s.divineNames === 'substituted' ? 'substituted' : 'written',
      showTranslation: s.showTranslation !== false,
      calendar: s.calendar === 'diaspora' ? 'diaspora' : 'il',
    };
  }
  if (isObj(o.active) && Array.isArray(o.active.questionIds)) {
    const a = o.active;
    const ids = (a.questionIds as unknown[]).filter((x): x is string => typeof x === 'string');
    if (ids.length && ['lesson', 'review', 'daily', 'placement'].includes(a.kind as string)) {
      p.active = {
        kind: a.kind as ActiveLesson['kind'], key: String(a.key ?? ''), book: typeof a.book === 'string' ? a.book : undefined,
        questionIds: ids, index: clamp(Math.floor(num(a.index)), 0, ids.length), hearts: clamp(num(a.hearts, 5), 0, 5),
        results: Array.isArray(a.results) ? a.results.map((x) => (x === null ? null : !!x)).slice(0, ids.length) : [],
        learnSeen: a.learnSeen === true, startedAt: isDay(a.startedAt) ? a.startedAt : '1970-01-01',
        pending: isObj(a.pending) && Array.isArray(a.pending.answer) ? { answer: a.pending.answer.map((x) => num(x)), correct: !!a.pending.correct } : undefined,
      };
    }
  }
  return p;
}

export const exportProgress = (p: Progress): string =>
  JSON.stringify({ app: 'shvil', exportedSchema: SCHEMA, ...p }, null, 2);

export function importProgress(json: string): Progress {
  let data: unknown;
  try { data = JSON.parse(json); } catch { throw new Error('not valid JSON'); }
  if (isObj(data) && data.app !== undefined && data.app !== 'shvil') throw new Error('not a Shvil progress file');
  return migrate(data);
}
