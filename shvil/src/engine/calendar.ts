/** Weekly parsha lookup over the build-time calendar table (computed with @hebcal/core). */
import { diffDays, type DayKey } from './dates.ts';

export interface CalendarData { il: [DayKey, string[]][]; diaspora: [DayKey, string[]][]; from: DayKey; to: DayKey }

/** The parsha(s) read on the first Shabbat on or after `today` that has a parsha reading. */
export function parshaOfWeek(cal: CalendarData, today: DayKey, where: 'il' | 'diaspora'): { date: DayKey; parshiyot: string[] } | undefined {
  const row = cal[where].find(([d]) => diffDays(today, d) >= 0);
  return row ? { date: row[0], parshiyot: row[1] } : undefined;
}
