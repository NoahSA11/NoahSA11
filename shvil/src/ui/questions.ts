/** Rendering, answering and feedback for each question type. */
import { nextRef, prevRef, verseAt } from '../engine/content.ts';
import { hebrewNumeral } from '../engine/hebrew.ts';
import type { BookContent, Question, Ref } from '../engine/types.ts';
import { sefariaUrl } from '../engine/types.ts';
import { en, h, he } from './dom.ts';
import { isHe, t } from './i18n.ts';
import { store } from './store.ts';
import { bookName, displayHe, displayPhrase, findParsha, parshaName, pasukEl, perekLabel, refEl } from './text.ts';

export type Books = Map<string, BookContent>;
const verseOf = (books: Books, r: Ref) => verseAt(books.get(r.book)!, r.c, r.v)!;

export function isCorrect(q: Question, answer: number[]): boolean {
  if (q.type === 'order') return answer.length === q.refs.length && answer.every((di, pos) => q.shuffled[di] === pos);
  return answer[0] === q.answerIndex;
}

export function prompt(q: Question, books: Books): string {
  const b = books.get(q.book)!;
  switch (q.type) {
    case 'cloze': return t('qCloze');
    case 'order': return t('qOrder');
    case 'where': return t(q.level === 'book' ? 'qWhereBook' : q.level === 'parsha' ? 'qWhereParsha' : 'qWherePerek');
    case 'rashi': return t('qRashi');
    case 'firstlast': {
      const c = Number(q.target);
      const target = q.scope === 'parsha' ? parshaName(findParsha(b, q.target)) : isHe() ? `${hebrewNumeral(c)} בספר ${bookName(q.book)}` : `${c} of ${bookName(q.book)}`;
      const key = q.scope === 'parsha' ? (q.which === 'first' ? 'qFirstParsha' : 'qLastParsha') : q.which === 'first' ? 'qFirstPerek' : 'qLastPerek';
      return `${t(key)} ${target}?`;
    }
  }
}

const optionLabel = (q: Question, i: number, books: Books): HTMLElement => {
  const b = books.get(q.book)!;
  switch (q.type) {
    case 'cloze': return he(displayPhrase(q.options[i]!.text), 'opt-he');
    case 'firstlast': return he(displayPhrase(q.options[i]!.text), 'opt-he');
    case 'rashi': return he(displayHe(verseOf(books, q.options[i]!).he, { cantillation: false }), 'opt-he opt-verse');
    case 'where': {
      const o = q.options[i]!;
      if (q.level === 'book') return h('span', {}, bookName(o));
      if (q.level === 'parsha') return h('span', {}, parshaName(findParsha(b, o)));
      return h('span', {}, perekLabel(Number(o)));
    }
    case 'order': return h('span');
  }
};

export interface RenderOpts {
  books: Books;
  /** Answer already given (after reload or once answered). */
  answered?: number[];
  onAnswer: (answer: number[]) => void;
}

/** Renders the question card. Calls onAnswer once. */
export function renderQuestion(q: Question, o: RenderOpts): HTMLElement {
  const card = h('section', { class: `qcard q-${q.type}`, 'aria-labelledby': 'qprompt' });
  card.append(h('h2', { id: 'qprompt', class: 'qprompt', tabindex: '-1' }, prompt(q, o.books)));
  const locked = !!o.answered;

  if (q.type === 'cloze') card.append(pasukEl(verseOf(o.books, q.ref).he, { blank: q.tokenIndex, cls: 'qpasuk' }));
  if (q.type === 'where') card.append(pasukEl(verseOf(o.books, q.ref).he, { cls: 'qpasuk' }));
  if (q.type === 'rashi') {
    card.append(h('blockquote', { class: 'rashi-q', lang: 'he', dir: 'rtl' },
      h('span', { class: 'rashi-label' }, 'רש״י: '),
      displayHe(q.body)));
    if (q.dh) {
      const dh = h('details', { class: 'dh' }, h('summary', {}, t('showDh')), he(displayHe(q.dh), 'dh-text', 'p'));
      card.append(dh);
    }
  }

  if (q.type === 'order') {
    const chosen: number[] = o.answered ? [...o.answered] : [];
    const placed = h('ol', { class: 'order-placed', 'aria-label': t('yourOrder') });
    const pool = h('div', { class: 'order-pool', role: 'group' });
    const check = h('button', { class: 'btn primary', type: 'button', disabled: true }, t('check'));
    const draw = () => {
      placed.replaceChildren(...chosen.map((di, pos) => h('li', {},
        h('button', { type: 'button', class: 'order-item placed', disabled: locked, 'aria-label': `${pos + 1}`, onclick: () => { chosen.splice(pos, 1); draw(); } },
          h('span', { class: 'order-num' }, String(pos + 1)), pasukEl(verseOf(o.books, q.refs[q.shuffled[di]!]!).he, { cls: 'small' })))));
      pool.replaceChildren(...q.shuffled.map((ri, di) => chosen.includes(di) ? null : h('button', {
        type: 'button', class: 'order-item', disabled: locked, onclick: () => { chosen.push(di); draw(); },
      }, pasukEl(verseOf(o.books, q.refs[ri]!).he, { cls: 'small' }))).filter(Boolean) as HTMLElement[]);
      check.disabled = locked || chosen.length !== q.refs.length;
    };
    check.addEventListener('click', () => o.onAnswer([...chosen]));
    draw();
    card.append(h('p', { class: 'hint' }, t('qOrderHint')), placed, pool);
    if (!locked) card.append(h('div', { class: 'actions' }, check));
    return card;
  }

  const opts = h('div', { class: 'options', role: 'group', 'aria-label': t('choose') });
  const n = q.options.length;
  for (let i = 0; i < n; i++) {
    const chosen = o.answered?.[0] === i;
    const right = locked && i === (q as { answerIndex: number }).answerIndex;
    const btn = h('button', {
      type: 'button',
      class: `option ${chosen ? 'chosen' : ''} ${right ? 'is-correct' : ''} ${chosen && !right ? 'is-wrong' : ''}`,
      disabled: locked,
      'aria-keyshortcuts': String(i + 1),
      onclick: () => o.onAnswer([i]),
    }, h('span', { class: 'opt-key', 'aria-hidden': 'true' }, String(i + 1)), optionLabel(q, i, o.books),
      right ? h('span', { class: 'mark' }, '✓ ', h('span', { class: 'sr-only' }, t('correctAnswer'))) : null,
      chosen && !right ? h('span', { class: 'mark' }, '✗') : null);
    opts.append(btn);
  }
  card.append(opts);
  return card;
}

/** The verse refs to show in feedback (the answer pasuk, or all pesukim for order). */
function feedbackRefs(q: Question): Ref[] {
  switch (q.type) {
    case 'cloze': case 'where': case 'rashi': return [q.ref];
    case 'order': return q.refs;
    case 'firstlast': return [q.options[q.answerIndex]!.ref];
  }
}

function verseBlock(books: Books, r: Ref, highlight: boolean): HTMLElement {
  const v = verseOf(books, r);
  return h('div', { class: `ctx-verse ${highlight ? 'hl' : 'dim'}` },
    h('div', { class: 'ctx-ref' }, refEl(r)),
    pasukEl(v.he),
    store.p.settings.showTranslation && v.en ? en(v.en, 'translation', 'p') : null);
}

/** Feedback panel: status (icon + text, never colour alone), correct answer, pasuk in context, Sefaria link. */
export function renderFeedback(q: Question, answer: number[], books: Books): HTMLElement {
  const ok = isCorrect(q, answer);
  const b = books.get(q.book)!;
  const refs = feedbackRefs(q);
  const box = h('section', { class: `feedback ${ok ? 'ok' : 'no'}`, role: 'status', 'aria-live': 'polite' });
  box.append(h('p', { class: 'fb-status' }, h('span', { class: 'fb-icon', 'aria-hidden': 'true' }, ok ? '✓' : '✗'), ' ', t(ok ? 'correct' : 'incorrect')));
  if (!ok && q.type !== 'order') {
    const correctLabel = optionLabel(q, q.answerIndex, books);
    box.append(h('p', { class: 'fb-answer' }, `${t('correctAnswer')}: `, correctLabel));
  }
  box.append(h('h3', { class: 'fb-src' }, t('source')));
  if (refs.length === 1) {
    const r = refs[0]!;
    const before = prevRef(b, r);
    const after = nextRef(b, r);
    if (before && q.type !== 'firstlast') box.append(verseBlock(books, before, false));
    box.append(verseBlock(books, r, true));
    if (after && q.type !== 'firstlast') box.append(verseBlock(books, after, false));
  } else for (const r of refs) box.append(verseBlock(books, r, true));

  if (q.type === 'rashi') {
    const v = verseOf(books, q.ref);
    box.append(h('blockquote', { class: 'rashi-fb', lang: 'he', dir: 'rtl' }, h('strong', {}, `רש״י · ${displayHe(q.dh)} `), displayHe(q.body)));
    if (v.rashiEn.length) box.append(h('details', { class: 'rashi-en' }, h('summary', {}, t('rashiEn')), ...v.rashiEn.map((x) => en(x, '', 'p'))));
  }
  const linkRef = refs[0]!;
  box.append(h('p', { class: 'links' },
    h('a', { href: sefariaUrl(linkRef), target: '_blank', rel: 'noopener', class: 'sefaria' }, `${t('openSefaria')} ↗ `, h('bdi', { lang: 'en' }, `${linkRef.book} ${linkRef.c}:${linkRef.v}${refs.length > 1 ? `–${refs.at(-1)!.v}` : ''}`)),
    q.type === 'rashi' ? h('a', { href: sefariaUrl(q.ref, q.commentIndex), target: '_blank', rel: 'noopener', class: 'sefaria' }, `Rashi ↗ `, h('bdi', { lang: 'en' }, `Rashi on ${q.ref.book} ${q.ref.c}:${q.ref.v}:${q.commentIndex + 1}`)) : null));
  return box;
}
