import { afterEach, describe, expect, it } from 'vitest';
import { parshaOfWeek, type CalendarData } from '../src/engine/calendar.ts';
import { dailyQuestions, lessonQuestions } from '../src/engine/daily-seed.ts';
import { addDays, dayKey, diffDays, weekday } from '../src/engine/dates.ts';
import { rng } from '../src/engine/prng.ts';
import { exportProgress, importProgress, migrate, newProgress, SCHEMA, type ProgressV1 } from '../src/engine/progress.ts';
import { dueItems, INTERVALS, mastery, schedule } from '../src/engine/spaced-repetition.ts';
import { displayStreak, levelFor, newStreak, recordActivity } from '../src/engine/xp-streak.ts';
import type { Question } from '../src/engine/types.ts';
import { readFileSync, existsSync } from 'node:fs';

const origTZ = process.env.TZ;
afterEach(() => { process.env.TZ = origTZ; });

describe('prng', () => {
  it('is deterministic and in range', () => {
    const a = rng('x'), b = rng('x');
    for (let i = 0; i < 100; i++) { const v = a.next(); expect(v).toBe(b.next()); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(rng(5).shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('dates across timezone / DST edges', () => {
  it('Israel DST start (2026-03-27) and end (2026-10-25) are one calendar day each', () => {
    process.env.TZ = 'Asia/Jerusalem';
    expect(dayKey(new Date(2026, 2, 27, 1, 30))).toBe('2026-03-27');
    expect(diffDays('2026-03-26', '2026-03-27')).toBe(1);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-26', 1)).toBe('2026-03-27');
  });
  it('US DST (2026-03-08) late-night activity keeps the streak', () => {
    process.env.TZ = 'America/New_York';
    const d1 = dayKey(new Date(2026, 2, 7, 23, 50));
    const d2 = dayKey(new Date(2026, 2, 8, 23, 50)); // 23-hour day
    expect(diffDays(d1, d2)).toBe(1);
    let s = recordActivity(newStreak(), d1);
    s = recordActivity(s, d2);
    expect(s.current).toBe(2);
  });
  it('local date, not UTC, decides the day (Jerusalem 01:00 = previous UTC day)', () => {
    process.env.TZ = 'Asia/Jerusalem';
    const d = new Date(Date.UTC(2026, 10, 3, 23, 0)); // 01:00 on Nov 4 in Israel
    expect(dayKey(d)).toBe('2026-11-04');
  });
  it('weekday', () => {
    expect(weekday('2026-11-07')).toBe(6); // Shabbat
    expect(weekday('2026-11-04')).toBe(3);
  });
  it('month and year rollovers', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('streak and freeze', () => {
  it('counts consecutive days and resets after a long gap', () => {
    let s = newStreak();
    s = recordActivity(s, '2026-11-01');
    s = recordActivity(s, '2026-11-01');
    s = recordActivity(s, '2026-11-02');
    expect(s.current).toBe(2);
    s = recordActivity({ ...s, freezes: 0 }, '2026-11-05');
    expect(s.current).toBe(1);
    expect(s.best).toBe(2);
  });
  it('one missed day is covered by the freeze, once', () => {
    let s = recordActivity(newStreak(), '2026-11-01');
    expect(s.freezes).toBe(1);
    s = recordActivity(s, '2026-11-03');
    expect(s.current).toBe(2);
    expect(s.freezes).toBe(0);
    expect(s.frozenDays).toEqual(['2026-11-02']);
    s = recordActivity(s, '2026-11-05');
    expect(s.current).toBe(1);
  });
  it('freeze is earned back every 7 days', () => {
    let s = { ...newStreak(), freezes: 0 };
    for (let i = 0; i < 7; i++) s = recordActivity(s, addDays('2026-01-01', i));
    expect(s.current).toBe(7);
    expect(s.freezes).toBe(1);
  });
  it('display streak', () => {
    const s = recordActivity(newStreak(), '2026-11-01');
    expect(displayStreak(s, '2026-11-02')).toBe(1);
    expect(displayStreak(s, '2026-11-03')).toBe(1); // freeze available
    expect(displayStreak({ ...s, freezes: 0 }, '2026-11-03')).toBe(0);
    expect(displayStreak(s, '2026-11-09')).toBe(0);
  });
  it('clock going backwards does not break the streak', () => {
    const s = recordActivity(recordActivity(newStreak(), '2026-11-02'), '2026-11-01');
    expect(s.current).toBe(1);
    expect(s.last).toBe('2026-11-02');
  });
});

describe('spaced repetition', () => {
  it('moves up on correct with growing intervals, back to box 1 on wrong', () => {
    let it = schedule(undefined, true, '2026-11-01');
    expect(it.box).toBe(1);
    expect(it.due).toBe(addDays('2026-11-01', INTERVALS[1]));
    it = schedule(it, true, '2026-11-02');
    expect(it.due).toBe('2026-11-04');
    it = schedule(it, true, '2026-11-04');
    expect(it.due).toBe('2026-11-08');
    it = schedule(it, false, '2026-11-08');
    expect(it).toMatchObject({ box: 1, due: '2026-11-08', seen: 4, correct: 3 });
  });
  it('lists due items most-overdue first', () => {
    const items = {
      a: { box: 2, due: '2026-11-03', seen: 1, correct: 1, last: '2026-11-01' },
      b: { box: 1, due: '2026-11-01', seen: 1, correct: 0, last: '2026-11-01' },
      c: { box: 3, due: '2026-11-09', seen: 1, correct: 1, last: '2026-11-01' },
    };
    expect(dueItems(items, '2026-11-04')).toEqual(['b', 'a']);
    expect(mastery(['a', 'b', 'c', 'd'], items)).toBeCloseTo((2 + 1 + 3 + 0) / 16);
  });
});

describe('levels', () => {
  it('maps xp to titles', () => {
    expect(levelFor(0).en).toBe('First steps');
    expect(levelFor(150).en).toBe('Beginner');
    expect(levelFor(99999).progress).toBe(1);
  });
});

describe('progress schema', () => {
  it('migrates v1 → current', () => {
    const v1: ProgressV1 = { schema: 1, xp: 120, streakCount: 3, lastDay: '2026-11-01', completed: ['Bereshit'], boxes: { 'Genesis:Bereshit:cloze:0': { box: 2, due: '2026-11-03' } }, lang: 'en' };
    const p = migrate(v1);
    expect(p.schema).toBe(SCHEMA);
    expect(p.xp).toBe(120);
    expect(p.streak.current).toBe(3);
    expect(p.parshiyot.Bereshit!.completed).toBe(1);
    expect(p.srs['Genesis:Bereshit:cloze:0']!.box).toBe(2);
    expect(p.settings.uiLang).toBe('en');
  });
  it('rejects garbage and newer schemas', () => {
    expect(() => importProgress('nope')).toThrow();
    expect(() => importProgress('{"app":"other","schema":2}')).toThrow();
    expect(() => importProgress(JSON.stringify({ schema: 99 }))).toThrow(/newer/);
    expect(() => migrate([])).toThrow();
  });
  it('sanitizes bad fields', () => {
    const p = migrate({ schema: 2, xp: -5, srs: { x: { box: 99, due: 'bad' }, y: { box: 99, due: '2026-01-01' } }, settings: { uiLang: 'fr' } });
    expect(p.xp).toBe(0);
    expect(p.srs.x).toBeUndefined();
    expect(p.srs.y!.box).toBe(6);
    expect(p.settings.uiLang).toBe('he');
  });
  it('export/import round-trip', () => {
    const p = newProgress();
    p.xp = 330;
    p.srs['Genesis:Noach:order:1'] = schedule(undefined, true, '2026-11-04');
    p.parshiyot.Noach = { completed: 2, best: 0.9, lastPlayed: '2026-11-04' };
    p.unlocked.Genesis = 3;
    p.daily['2026-11-04'] = { score: 8, total: 10, results: [true, false, true, true, true, true, true, false, true, true] };
    p.settings.divineNames = 'substituted';
    p.active = { kind: 'lesson', key: 'Noach', book: 'Genesis', questionIds: ['a', 'b'], index: 1, hearts: 4, results: [true, null], learnSeen: true, startedAt: '2026-11-04' };
    expect(importProgress(exportProgress(p))).toEqual(p);
  });
});

const bankFile = 'public/content/bank-Genesis.json';
describe.runIf(existsSync(bankFile))('daily challenge & lessons', () => {
  const qs: Question[] = JSON.parse(readFileSync(bankFile, 'utf8')).questions;
  it('daily is deterministic per date, 10 mixed questions', () => {
    const a = dailyQuestions(qs, '2026-11-04');
    expect(a).toHaveLength(10);
    expect(a.map((q) => q.id)).toEqual(dailyQuestions([...qs].reverse(), '2026-11-04').map((q) => q.id));
    expect(new Set(a.map((q) => q.type)).size).toBe(5);
    expect(a.map((q) => q.id)).not.toEqual(dailyQuestions(qs, '2026-11-05').map((q) => q.id));
  });
  it('lessons prefer unseen items', () => {
    const bank = qs.filter((q) => q.parsha === 'Noach');
    const first = lessonQuestions(bank, {}, '2026-11-04', 's1');
    const srs = Object.fromEntries(first.map((q) => [q.id, schedule(undefined, true, '2026-11-04')]));
    const second = lessonQuestions(bank, srs, '2026-11-04', 's2');
    expect(second.filter((q) => srs[q.id]).length).toBeLessThan(3);
  });
});

describe.runIf(existsSync('public/content/calendar.json'))('parsha of the week', () => {
  const cal: CalendarData = JSON.parse(readFileSync('public/content/calendar.json', 'utf8'));
  it('every calendar date is a Shabbat and the table covers the 53 Shabbat parshiyot', () => {
    for (const [d] of [...cal.il, ...cal.diaspora]) expect(weekday(d)).toBe(6);
    // V'Zot HaBerachah is read on Simchat Torah, never on a Shabbat.
    expect(new Set(cal.il.flatMap(([, p]) => p)).size).toBe(53);
    expect(new Set(cal.diaspora.flatMap(([, p]) => p)).size).toBe(53);
    const y = cal.il.filter(([d]) => d >= '2026-10-01' && d < '2027-10-01').flatMap(([, p]) => p);
    expect(new Set(y).size).toBe(y.length); // no parsha twice in one cycle
  });
  it('finds the upcoming Shabbat reading', () => {
    const w = parshaOfWeek(cal, '2026-11-04', 'il')!;
    expect(weekday(w.date)).toBe(6);
    expect(diffDays('2026-11-04', w.date)).toBeLessThan(7);
  });
});
