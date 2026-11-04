/** Progress persistence. localStorage access is always wrapped in try/catch. */
import { migrate, newProgress, STORAGE_KEY, type Progress } from '../engine/progress.ts';
import { dayKey } from '../engine/dates.ts';

function load(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.warn('Shvil: could not read saved progress, starting fresh', e);
  }
  return newProgress();
}

export const store = {
  p: newProgress(),
  init() { this.p = load(); },
  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.p)); } catch (e) { console.warn('Shvil: could not save progress', e); }
  },
  replace(p: Progress) { this.p = p; this.save(); },
};

/** Today's local date key. `?today=YYYY-MM-DD` overrides it (used by tests and screenshots). */
export function today(): string {
  try {
    const q = new URLSearchParams(location.search).get('today');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  } catch { /* ignore */ }
  return dayKey(new Date());
}
