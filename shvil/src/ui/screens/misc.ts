/** Review, Daily, Settings and Credits screens. */
import { dailyQuestions, reviewIds } from '../../engine/daily-seed.ts';
import { exportProgress, importProgress, newProgress } from '../../engine/progress.ts';
import { allQuestions, loadIndex } from '../data.ts';
import { h } from '../dom.ts';
import { t } from '../i18n.ts';
import { go } from '../router.ts';
import { begin, shareText } from '../session.ts';
import { store, today } from '../store.ts';
import { applySettings } from '../theme.ts';

export function renderReview(root: HTMLElement) {
  const ids = reviewIds(store.p.srs, today(), 12);
  root.replaceChildren(h('section', { class: 'page' },
    h('h1', { tabindex: '-1' }, t('review')),
    ids.length
      ? h('div', {}, h('p', {}, h('bdi', {}, String(ids.length)), ` ${t('reviewDue')}`),
        h('button', { class: 'btn primary', type: 'button', onclick: () => begin({ kind: 'review', key: today(), questionIds: ids }) }, t('start')))
      : h('p', {}, t('reviewEmpty'))));
}

export async function renderDaily(root: HTMLElement) {
  const day = today();
  const done = store.p.daily[day];
  root.replaceChildren(h('p', { class: 'loading' }, t('loading')));
  const qs = dailyQuestions(await allQuestions(), day);
  root.replaceChildren(h('section', { class: 'page' },
    h('h1', { tabindex: '-1' }, t('dailyTitle')),
    h('p', {}, h('bdi', { dir: 'ltr' }, day), ' · ', t('dailySub')),
    done
      ? h('div', {}, h('p', {}, `✓ ${t('dailyDone')}: `, h('bdi', {}, `${done.score}/${done.total}`)), h('pre', { class: 'share-text', dir: 'ltr' }, shareText(day, done.results)))
      : h('button', { class: 'btn primary', type: 'button', onclick: () => begin({ kind: 'daily', key: day, questionIds: qs.map((q) => q.id) }) }, t('start'))));
}

function toggle(label: string, value: boolean, onChange: (v: boolean) => void) {
  const id = `t-${label.replace(/\W/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
  return h('div', { class: 'setting' }, h('label', { for: id }, label),
    h('input', { id, type: 'checkbox', role: 'switch', class: 'switch', checked: value, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) }));
}
function choice<T extends string>(label: string, value: T, opts: [T, string][], onChange: (v: T) => void) {
  return h('fieldset', { class: 'setting' }, h('legend', {}, label), h('div', { class: 'seg' }, ...opts.map(([v, l]) =>
    h('button', { type: 'button', class: `seg-btn ${v === value ? 'on' : ''}`, 'aria-pressed': v === value ? 'true' : 'false', onclick: () => onChange(v) }, l))));
}

export function renderSettings(root: HTMLElement) {
  const st = store.p.settings;
  const set = (f: () => void) => { f(); store.save(); applySettings(); renderSettings(root); };
  const msg = h('p', { class: 'sr-live', 'aria-live': 'polite' });
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'import-file', onchange: async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try { store.replace(importProgress(await f.text())); applySettings(); msg.textContent = t('imported'); renderSettings(root); }
    catch (err) { msg.textContent = `${t('importFailed')}: ${(err as Error).message}`; }
  } });
  root.replaceChildren(h('section', { class: 'page' },
    h('h1', { tabindex: '-1' }, t('settings')),
    choice(t('uiLang'), st.uiLang, [['he', 'עברית'], ['en', 'English']], (v) => set(() => { st.uiLang = v; })),
    toggle(t('cantillation'), st.cantillation, (v) => set(() => { st.cantillation = v; })),
    h('p', { class: 'preview', lang: 'he', dir: 'rtl' }, st.cantillation ? 'בְּרֵאשִׁ֖ית בָּרָ֣א' : 'בְּרֵאשִׁית בָּרָא'),
    choice(t('divineNames'), st.divineNames, [['written', t('dnWritten')], ['substituted', t('dnSub')]], (v) => set(() => { st.divineNames = v; })),
    h('p', { class: 'hint' }, t('dnNote')),
    toggle(t('translation'), st.showTranslation, (v) => set(() => { st.showTranslation = v; })),
    choice(t('calendar'), st.calendar, [['il', t('il')], ['diaspora', t('diaspora')]], (v) => set(() => { st.calendar = v; })),
    h('hr'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', type: 'button', onclick: () => {
        const blob = new Blob([exportProgress(store.p)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `shvil-progress-${today()}.json` });
        document.body.append(a); a.click(); a.remove();
      } }, t('exportP')),
      h('label', { class: 'btn', for: 'import-file', tabindex: '0', onkeydown: (e: Event) => { if ((e as KeyboardEvent).key === 'Enter') file.click(); } }, t('importP')), file,
      h('button', { class: 'btn danger', type: 'button', onclick: () => { if (confirm(t('resetConfirm'))) { store.replace(newProgress()); applySettings(); go('#/'); } } }, t('resetP'))),
    msg,
    h('p', { class: 'hint' }, t('privacy'))));
}

export async function renderCredits(root: HTMLElement) {
  const ix = await loadIndex();
  const groups = new Map<string, typeof ix.credits>();
  for (const c of ix.credits) {
    const k = `${c.language}|${c.versionTitle}|${c.license}`;
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  root.replaceChildren(h('section', { class: 'page credits' },
    h('h1', { tabindex: '-1' }, t('credits')),
    h('p', {}, t('creditsIntro')),
    h('p', {}, h('a', { href: 'https://www.sefaria.org', target: '_blank', rel: 'noopener' }, 'Sefaria — sefaria.org'), ' · ', h('bdi', {}, ix.builtFrom)),
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, t('version')), h('th', {}, t('licence')), h('th', {}, 'Texts'))),
      h('tbody', {}, ...[...groups.values()].map((g) => {
        const c = g[0]!;
        return h('tr', {},
          h('td', { lang: 'en', dir: 'ltr' }, h('a', { href: c.versionSource ?? '#', target: '_blank', rel: 'noopener' }, c.versionTitle ?? ''), c.versionTitleInHebrew ? h('div', { lang: 'he', dir: 'rtl', class: 'small' }, c.versionTitleInHebrew) : null),
          h('td', { lang: 'en', dir: 'ltr' }, c.license ?? '?'),
          h('td', { lang: 'en', dir: 'ltr', class: 'small' }, g.map((x) => x.title).join(', ')));
      })))),
    h('p', { class: 'hint' }, 'Font: Frank Ruhl Libre (SIL Open Font License 1.1), self-hosted. Weekly parsha table computed at build time with @hebcal/core (GPL-2.0).'),
    h('p', { class: 'hint' }, t('personalNote'))));
}
