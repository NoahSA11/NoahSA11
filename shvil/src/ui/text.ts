/** Display transforms for Hebrew text (stored text is never modified). */
import { hebrewNumeral, stripCantillation, substituteDivineNames, tokenize } from '../engine/hebrew.ts';
import type { BookContent, Parsha, Ref } from '../engine/types.ts';
import { h } from './dom.ts';
import { isHe } from './i18n.ts';
import { store } from './store.ts';

export function displayHe(text: string, opts: { cantillation?: boolean } = {}): string {
  const st = store.p.settings;
  let s = (opts.cantillation ?? st.cantillation) ? text : stripCantillation(text);
  if (st.divineNames === 'substituted') s = substituteDivineNames(s);
  return s;
}

/** Option/phrase display: nikud only, no sof pasuq. */
export const displayPhrase = (text: string) => displayHe(text, { cantillation: false }).replace(/׃/g, '').trim();

/** Render a pasuk with ketiv/qere and parasha markers styled. `blank` replaces one token. */
export function pasukEl(he: string, opts: { blank?: number; blankContent?: Node; cls?: string } = {}): HTMLElement {
  const p = h('p', { lang: 'he', dir: 'rtl', class: `pasuk ${opts.cls ?? ''}` });
  tokenize(he).forEach((tok, i) => {
    if (i > 0) p.append(' ');
    if (i === opts.blank) {
      p.append(opts.blankContent ?? h('span', { class: 'blank', 'aria-label': '___' }, '＿＿＿'));
      if (/׃$/.test(tok.text)) p.append('׃');
      return;
    }
    const txt = displayHe(tok.text);
    if (tok.kind === 'ketiv') p.append(h('span', { class: 'ketiv', title: 'כתיב' }, `(${txt})`));
    else if (tok.kind === 'qere') p.append(h('span', { class: 'qere', title: 'קרי' }, txt));
    else if (tok.kind === 'marker') p.append(h('span', { class: 'marker', 'aria-hidden': 'true' }, txt.replace(/[()]/g, '')));
    else p.append(txt);
  });
  return p;
}

const HE_BOOK: Record<string, string> = { Genesis: 'בראשית', Exodus: 'שמות', Leviticus: 'ויקרא', Numbers: 'במדבר', Deuteronomy: 'דברים' };
export const bookName = (title: string, lang = isHe() ? 'he' : 'en') => (lang === 'he' ? HE_BOOK[title] ?? title : title);
export const parshaName = (p: Parsha | undefined, lang = isHe() ? 'he' : 'en') => (p ? (lang === 'he' ? p.heTitle : p.title) : '');

/** Hebrew or English reference label, wrapped in <bdi> by callers. */
export function refLabel(r: Ref, lang = isHe() ? 'he' : 'en'): string {
  return lang === 'he' ? `${HE_BOOK[r.book] ?? r.book} ${hebrewNumeral(r.c)}, ${hebrewNumeral(r.v)}` : `${r.book} ${r.c}:${r.v}`;
}
export const refEl = (r: Ref) => h('span', { class: 'ref' }, h('bdi', { lang: 'he' }, refLabel(r, 'he')), ' · ', h('bdi', { lang: 'en', dir: 'ltr' }, `${r.book} ${r.c}:${r.v}`));

export const findParsha = (b: BookContent, id: string) => b.parshiyot.find((p) => p.id === id);
export const perekLabel = (c: number) => (isHe() ? `פרק ${hebrewNumeral(c)}` : `Chapter ${c}`);
