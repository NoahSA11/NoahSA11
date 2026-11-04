/** Home: book tabs, winding path map of parshiyot, daily / review / weekly cards. */
import { parshaOfWeek } from '../../engine/calendar.ts';
import { reviewIds } from '../../engine/daily-seed.ts';
import { mastery } from '../../engine/spaced-repetition.ts';
import { displayStreak, levelFor } from '../../engine/xp-streak.ts';
import { loadBank, loadCalendar, loadIndex } from '../data.ts';
import { h, s } from '../dom.ts';
import { isHe, t } from '../i18n.ts';
import { go } from '../router.ts';
import { setWeekly, startLesson, startPlacement } from '../session.ts';
import { store, today } from '../store.ts';
import { bookName } from '../text.ts';

let currentBook = 'Genesis';

export function statusBar(): HTMLElement {
  const p = store.p;
  const lv = levelFor(p.xp);
  const st = displayStreak(p.streak, today());
  return h('div', { class: 'status' },
    h('span', { class: 'stat', title: t('streak') }, h('span', { 'aria-hidden': 'true' }, '🌱 '), h('bdi', {}, String(st)), ' ', h('span', { class: 'stat-l' }, t('days')),
      h('span', { class: 'freeze', title: p.streak.freezes ? t('freeze') : t('noFreeze') }, p.streak.freezes ? ' ❄' : '')),
    h('span', { class: 'stat' }, h('bdi', {}, String(p.xp)), ' ', h('span', { class: 'stat-l' }, t('xp'))),
    h('span', { class: 'stat level' }, isHe() ? lv.he : lv.en,
      h('span', { class: 'lvbar', role: 'progressbar', 'aria-label': t('level'), 'aria-valuenow': String(Math.round(lv.progress * 100)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
        h('span', { style: `width:${Math.round(lv.progress * 100)}%` }))));
}

export async function renderPath(root: HTMLElement, params: string[]) {
  if (params[0]) currentBook = decodeURIComponent(params[0]);
  const ix = await loadIndex();
  const book = ix.books.find((b) => b.title === currentBook) ?? ix.books[0]!;
  const bank = await loadBank(book.title);
  const cal = await loadCalendar().catch(() => undefined);
  const wk = cal ? parshaOfWeek(cal, today(), store.p.settings.calendar) : undefined;
  setWeekly(wk);
  const dueN = reviewIds(store.p.srs, today(), 99).length;
  const p = store.p;
  const unlockedUpTo = p.unlocked[book.title] ?? 0;

  const tabs = h('nav', { class: 'book-tabs', 'aria-label': t('book') }, ...ix.books.map((b) =>
    h('a', { href: `#/book/${b.title}`, class: `tab ${b.title === book.title ? 'active' : ''}`, 'aria-current': b.title === book.title ? 'page' : undefined, lang: isHe() ? 'he' : 'en' }, bookName(b.title))));

  const cards = h('div', { class: 'cards' });
  if (p.active) cards.append(h('a', { class: 'card resume', href: '#/session' }, h('strong', {}, t('resume')), ' →'));
  if (wk) {
    const all = ix.books.flatMap((b) => b.parshiyot);
    const names = wk.parshiyot.map((id) => all.find((x) => x.id === id)).filter(Boolean);
    const target = names[0]!;
    const done = p.weekly[wk.date];
    cards.append(h('button', { type: 'button', class: 'card weekly', onclick: () => startLesson(target.book, target.id) },
      h('span', { class: 'card-k' }, t('weekly')),
      h('strong', { lang: isHe() ? 'he' : 'en' }, names.map((x) => (isHe() ? x!.heTitle : x!.title)).join('–')),
      h('span', { class: 'card-s' }, done ? `✓ ${t('weeklyDone')}` : t('weeklyQuest'))));
  }
  const dailyDone = p.daily[today()];
  cards.append(h('a', { class: 'card', href: '#/daily' }, h('span', { class: 'card-k' }, t('daily')), h('strong', {}, dailyDone ? `✓ ${dailyDone.score}/${dailyDone.total}` : t('dailySub'))));
  cards.append(h('a', { class: 'card', href: '#/review' }, h('span', { class: 'card-k' }, t('review')), h('strong', {}, h('bdi', {}, String(dueN)), ` ${t('reviewDue')}`)));

  // Winding path
  const W = 320, STEP = 128, n = book.parshiyot.length, H = STEP * n + 60;
  const xs = (i: number) => W / 2 + Math.sin(i * 1.1) * 95;
  const ys = (i: number) => 50 + i * STEP;
  let d = `M ${xs(0)} ${ys(0)}`;
  for (let i = 1; i < n; i++) {
    const my = (ys(i - 1) + ys(i)) / 2;
    d += ` C ${xs(i - 1)} ${my}, ${xs(i)} ${my}, ${xs(i)} ${ys(i)}`;
  }
  const svg = s('svg', { class: 'path-svg', viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', preserveAspectRatio: 'xMidYMin meet' }, s('path', { d, class: 'trail' }));
  const nodes = h('ol', { class: 'path-nodes', style: `--h:${H}px` });
  book.parshiyot.forEach((par, i) => {
    const ids = bank.questions.filter((q) => q.parsha === par.id).map((q) => q.id);
    const m = mastery(ids, p.srs);
    const done = (p.parshiyot[par.id]?.completed ?? 0) > 0;
    const open = i <= unlockedUpTo;
    const isWeek = wk?.parshiyot.includes(par.id);
    const R = 30, C = 2 * Math.PI * (R + 5);
    const ring = s('svg', { class: 'ring', viewBox: '0 0 80 80', 'aria-hidden': 'true' },
      s('circle', { cx: 40, cy: 40, r: R + 5, class: 'ring-bg' }),
      s('circle', { cx: 40, cy: 40, r: R + 5, class: 'ring-fg', 'stroke-dasharray': m > 0 ? `${C * m} ${C}` : `0 ${C}`, 'stroke-opacity': m > 0 ? 1 : 0, transform: 'rotate(-90 40 40)' }));
    const label = `${isHe() ? par.heTitle : par.title}. ${open ? (done ? t('completed') : '') : t('locked')}. ${t('mastery')} ${Math.round(m * 100)}%`;
    nodes.append(h('li', { class: 'node-li', style: `top:${(ys(i) / H) * 100}%;left:${(xs(i) / W) * 100}%` },
      h('button', {
        type: 'button', class: `node ${done ? 'done' : ''} ${open ? 'open' : 'locked'} ${isWeek ? 'week' : ''}`,
        'aria-label': label, disabled: !open, onclick: () => startLesson(book.title, par.id),
      }, ring, h('span', { class: 'node-icon', 'aria-hidden': 'true' }, open ? (done ? '✓' : String(i + 1)) : '🔒')),
      h('span', { class: 'node-label', lang: 'he' }, par.heTitle, h('span', { class: 'node-en', lang: 'en' }, par.title))));
  });

  const placementSel = h('select', { id: 'placement-target', 'aria-label': t('parsha') },
    ...book.parshiyot.map((par, i) => i > unlockedUpTo ? h('option', { value: par.id }, isHe() ? par.heTitle : par.title) : null));
  const placement = unlockedUpTo < n - 1 ? h('details', { class: 'placement' },
    h('summary', {}, t('placement')),
    h('p', { class: 'hint' }, t('placementSub')),
    h('div', { class: 'row' }, placementSel, h('button', { type: 'button', class: 'btn', onclick: () => startPlacement(book.title, placementSel.value) }, t('start')))) : null;

  root.replaceChildren(
    statusBar(), cards, tabs,
    h('h1', { class: 'book-title', lang: isHe() ? 'he' : 'en' }, bookName(book.title)),
    h('div', { class: 'path' }, svg, nodes),
    placement ?? '');
  void go;
}
