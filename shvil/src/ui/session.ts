/** Runs a lesson, review, daily challenge or placement quiz. State is persisted after every step (survives reload). */
import { addDays } from '../engine/dates.ts';
import { lessonQuestions, PLACEMENT_PASS, placementQuestions } from '../engine/daily-seed.ts';
import { parshaRefs, verseAt } from '../engine/content.ts';
import type { ActiveLesson } from '../engine/progress.ts';
import { schedule } from '../engine/spaced-repetition.ts';
import type { BookContent, Question } from '../engine/types.ts';
import { recordActivity, XP } from '../engine/xp-streak.ts';
import { loadBank, loadBook, questionsById } from './data.ts';
import { en, h } from './dom.ts';
import { t } from './i18n.ts';
import { isCorrect, renderFeedback, renderQuestion, type Books } from './questions.ts';
import { go } from './router.ts';
import { store, today } from './store.ts';
import { displayHe, findParsha, parshaName, pasukEl, refEl } from './text.ts';
import { sefariaUrl } from '../engine/types.ts';

export const MAX_HEARTS = 5;

export async function startLesson(book: string, parshaId: string) {
  const bank = (await loadBank(book)).questions.filter((q) => q.parsha === parshaId);
  const attempt = store.p.parshiyot[parshaId]?.completed ?? 0;
  const qs = lessonQuestions(bank, store.p.srs, today(), `lesson:${parshaId}:${attempt}:${today()}`);
  begin({ kind: 'lesson', key: parshaId, book, questionIds: qs.map((q) => q.id) });
}

export async function startPlacement(book: string, parshaId: string) {
  const bank = (await loadBank(book)).questions.filter((q) => q.parsha === parshaId);
  const qs = placementQuestions(bank, `placement:${parshaId}:${today()}`);
  begin({ kind: 'placement', key: parshaId, book, questionIds: qs.map((q) => q.id) });
}

export function begin(a: Pick<ActiveLesson, 'kind' | 'key' | 'book' | 'questionIds'>) {
  store.p.active = { ...a, index: 0, hearts: MAX_HEARTS, results: a.questionIds.map(() => null), learnSeen: a.kind !== 'lesson', startedAt: today() };
  store.save();
  go('#/session');
}

async function booksFor(qs: Question[], extra?: string): Promise<Books> {
  const titles = new Set(qs.map((q) => q.book));
  if (extra) titles.add(extra);
  const m: Books = new Map();
  for (const b of await Promise.all([...titles].map(loadBook))) m.set(b.title, b);
  return m;
}

function heartsEl(n: number) {
  return h('span', { class: 'hearts', 'aria-label': `${t('hearts')}: ${n}/${MAX_HEARTS}` },
    ...Array.from({ length: MAX_HEARTS }, (_, i) => h('span', { class: i < n ? 'heart' : 'heart empty', 'aria-hidden': 'true' }, i < n ? '♥' : '♡')));
}

function learnCard(b: BookContent, parshaId: string, onStart: () => void): HTMLElement {
  const p = findParsha(b, parshaId)!;
  const refs = parshaRefs(b, p).slice(0, 4);
  const firstRashi = parshaRefs(b, p).map((r) => ({ r, v: verseAt(b, r.c, r.v)! })).find((x) => x.v.rashi.length);
  const card = h('section', { class: 'learn' },
    h('h2', { tabindex: '-1', class: 'qprompt' }, `${t('learnFirst')}: ${parshaName(p)}`),
    h('p', { class: 'hint' }, t('learnFirstSub')),
    ...refs.map((r) => {
      const v = verseAt(b, r.c, r.v)!;
      return h('div', { class: 'ctx-verse hl' }, h('div', { class: 'ctx-ref' }, refEl(r)), pasukEl(v.he), store.p.settings.showTranslation ? en(v.en, 'translation', 'p') : null);
    }),
    h('p', { class: 'links' }, h('a', { class: 'sefaria', href: sefariaUrl(refs[0]!), target: '_blank', rel: 'noopener' }, `${t('openSefaria')} ↗`)));
  if (firstRashi) {
    const c = firstRashi.v.rashi[0]!;
    card.append(h('h3', {}, t('firstRashi')), h('div', { class: 'ctx-ref' }, refEl(firstRashi.r)),
      h('blockquote', { class: 'rashi-fb', lang: 'he', dir: 'rtl' }, h('strong', {}, displayHe(c.dh) + ' '), displayHe(c.body)),
      h('p', { class: 'links' }, h('a', { class: 'sefaria', href: sefariaUrl(firstRashi.r, 0), target: '_blank', rel: 'noopener' }, `Rashi ↗`)));
  }
  card.append(h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: onStart }, t('startLesson'))));
  return card;
}

export async function renderSession(root: HTMLElement) {
  const a = store.p.active;
  if (!a) return go('#/');
  root.replaceChildren(h('p', { class: 'loading' }, t('loading')));
  const qs = await questionsById(a.questionIds);
  const books = await booksFor(qs, a.book);
  const draw = () => {
    const a = store.p.active;
    if (!a) return;
    const top = h('header', { class: 'session-top' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { store.p.active = undefined; store.save(); go('#/'); } }, t('quit')),
      h('div', { class: 'progressbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(qs.length), 'aria-valuenow': String(a.index), 'aria-label': `${a.index} ${t('of')} ${qs.length}` },
        h('div', { class: 'progressbar-fill', style: `width:${(100 * a.index) / Math.max(1, qs.length)}%` })),
      a.kind === 'lesson' ? heartsEl(a.hearts) : h('span', { class: 'counter' }, `${Math.min(a.index + 1, qs.length)}/${qs.length}`));
    const main = h('div', { class: 'session-body' });
    root.replaceChildren(top, main);

    if (!a.learnSeen && a.book) {
      main.append(learnCard(books.get(a.book)!, a.key, () => { a.learnSeen = true; store.save(); draw(); }));
      focusHeading(main);
      return;
    }
    if (a.index >= qs.length || (a.kind === 'lesson' && a.hearts <= 0)) return finish(main, qs, books);

    const q = qs[a.index]!;
    const answered = a.pending?.answer;
    main.append(renderQuestion(q, {
      books, answered,
      onAnswer: (ans) => {
        const ok = isCorrect(q, ans);
        a.pending = { answer: ans, correct: ok };
        a.results[a.index] = ok;
        if (!ok && a.kind === 'lesson') a.hearts = Math.max(0, a.hearts - 1);
        store.p.srs[q.id] = schedule(store.p.srs[q.id], ok, today());
        if (ok) store.p.xp += XP.correct;
        store.save();
        draw();
      },
    }));
    if (answered) {
      main.append(renderFeedback(q, answered, books));
      const cont = h('button', { class: 'btn primary', type: 'button', id: 'continue', onclick: () => { a.pending = undefined; a.index++; store.save(); draw(); } }, t('continue'));
      main.append(h('div', { class: 'actions sticky' }, cont));
      cont.focus();
    } else focusHeading(main);
  };
  keyHandler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (/^[1-4]$/.test(e.key)) (root.querySelectorAll<HTMLButtonElement>('.options .option:not([disabled])')[Number(e.key) - 1])?.click();
  };
  draw();
}

let keyHandler: ((e: KeyboardEvent) => void) | undefined;
document.addEventListener('keydown', (e) => keyHandler?.(e));
export const clearKeys = () => { keyHandler = undefined; };

function focusHeading(el: HTMLElement) {
  requestAnimationFrame(() => el.querySelector<HTMLElement>('h2')?.focus({ preventScroll: false }));
}

function finish(main: HTMLElement, qs: Question[], books: Books) {
  const a = store.p.active!;
  const correct = a.results.filter((x) => x === true).length;
  const total = qs.length;
  const day = today();
  let xp = correct * XP.correct;
  const outOfHearts = a.kind === 'lesson' && a.hearts <= 0;
  const p = store.p;
  let title = t('lessonDone');
  let sub = '';
  const extra: HTMLElement[] = [];
  if (outOfHearts) { title = t('outOfHearts'); sub = t('outOfHeartsSub'); }
  else if (a.kind === 'lesson') {
    const bonus = XP.lessonComplete + (correct === total ? XP.perfect : 0);
    p.xp += bonus; xp += bonus;
    const pp = p.parshiyot[a.key] ?? { completed: 0, best: 0 };
    p.parshiyot[a.key] = { completed: pp.completed + 1, best: Math.max(pp.best, correct / total), lastPlayed: day };
    const b = books.get(a.book!)!;
    const idx = b.parshiyot.findIndex((x) => x.id === a.key);
    p.unlocked[b.title] = Math.max(p.unlocked[b.title] ?? 0, idx + 1);
    const wk = weeklyKey();
    if (wk && wk.parshiyot.includes(a.key) && !p.weekly[wk.date]) { p.weekly[wk.date] = true; p.xp += XP.weeklyQuest; xp += XP.weeklyQuest; extra.push(h('p', { class: 'badge' }, `✦ ${t('weeklyDone')} (+${XP.weeklyQuest})`)); }
  } else if (a.kind === 'daily') {
    if (!p.daily[a.key]) { p.daily[a.key] = { score: correct, total, results: a.results.map(Boolean) }; p.xp += XP.dailyComplete; xp += XP.dailyComplete; }
    extra.push(shareBlock(a.key, p.daily[a.key]!.results));
    title = t('dailyDone');
  } else if (a.kind === 'placement') {
    const pass = correct >= PLACEMENT_PASS;
    title = t(pass ? 'placementPass' : 'placementFail');
    if (pass) {
      const b = books.get(a.book!)!;
      const idx = b.parshiyot.findIndex((x) => x.id === a.key);
      p.unlocked[b.title] = Math.max(p.unlocked[b.title] ?? 0, idx + 1);
    }
  }
  if (correct > 0 || a.kind !== 'lesson') p.streak = recordActivity(p.streak, day);
  const kind = a.kind, key = a.key, book = a.book;
  p.active = undefined;
  store.save();
  const celebrate = !outOfHearts;
  main.replaceChildren(h('section', { class: `done ${celebrate ? 'celebrate' : ''}` },
    celebrate ? h('div', { class: 'glow', 'aria-hidden': 'true' }, '✦') : null,
    h('h2', { tabindex: '-1' }, title),
    sub ? h('p', {}, sub) : null,
    h('p', { class: 'score' }, `${t('score')}: `, h('bdi', {}, `${correct}/${total}`)),
    h('p', { class: 'score' }, `${t('xpEarned')}: `, h('bdi', {}, `+${xp}`)),
    ...extra,
    h('div', { class: 'actions' },
      kind === 'lesson' && book ? h('button', { class: 'btn', type: 'button', onclick: () => startLesson(book, key) }, t('tryAgain')) : null,
      h('button', { class: 'btn primary', type: 'button', onclick: () => go('#/') }, t('backToPath')))));
  focusHeading(main);
}

export function shareText(day: string, results: boolean[]) {
  const n = results.filter(Boolean).length;
  return `שביל · Shvil ${day}\n${results.map((r) => (r ? '🟩' : '⬜')).join('')}\n${n}/${results.length}`;
}

function shareBlock(day: string, results: boolean[]) {
  const text = shareText(day, results);
  const status = h('span', { class: 'sr-live', 'aria-live': 'polite' });
  return h('div', { class: 'share' }, h('pre', { class: 'share-text', dir: 'ltr' }, text),
    h('button', { class: 'btn', type: 'button', onclick: async () => {
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); status.textContent = t('copied'); }
      } catch { /* user cancelled */ }
    } }, t('share')), status);
}

/** Set by the home screen once the calendar is loaded. */
let weekly: { date: string; parshiyot: string[] } | undefined;
export const setWeekly = (w: typeof weekly) => { weekly = w; };
export const weeklyKey = () => weekly;
export const yesterday = () => addDays(today(), -1);
