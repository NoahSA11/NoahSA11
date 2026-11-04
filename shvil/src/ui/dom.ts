/** Minimal DOM helpers. */
type Child = Node | string | number | false | null | undefined | Child[];
export type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: Child[]) {
  for (const c of children.flat(10 as 1)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s(tag: string, attrs: Record<string, string | number> = {}, ...children: (Node | string)[]): SVGElement {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

/** Hebrew text node with correct lang/dir. */
export const he = (text: string, cls = '', tag: 'span' | 'p' | 'div' = 'span') => h(tag, { lang: 'he', dir: 'rtl', class: `he ${cls}`.trim() }, text);
/** English text node with correct lang/dir. */
export const en = (text: string, cls = '', tag: 'span' | 'p' | 'div' = 'span') => h(tag, { lang: 'en', dir: 'ltr', class: `en ${cls}`.trim() }, text);
