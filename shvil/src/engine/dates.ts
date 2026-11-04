/**
 * Calendar-day arithmetic on local date keys ("YYYY-MM-DD"). Day differences are
 * computed on the date key, never on millisecond deltas, so DST transitions and
 * timezone offsets cannot produce 23- or 25-hour "days".
 */
export type DayKey = string;

export const dayKey = (d: Date): DayKey =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function dayNumber(k: DayKey): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) throw new Error(`bad day key ${k}`);
  return Math.round(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) / 86_400_000);
}

export const diffDays = (a: DayKey, b: DayKey): number => dayNumber(b) - dayNumber(a);

export function addDays(k: DayKey, n: number): DayKey {
  const d = new Date((dayNumber(k) + n) * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 0 = Sunday … 6 = Shabbat. */
export const weekday = (k: DayKey): number => (((dayNumber(k) + 4) % 7) + 7) % 7;
