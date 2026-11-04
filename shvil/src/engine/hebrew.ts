/**
 * Pure Hebrew text utilities. No DOM. These never alter stored text; they
 * produce display or comparison forms.
 */

/** Cantillation marks (te'amim) U+0591–U+05AF. */
const TEAMIM = /[\u0591-\u05AF\u05BD]/g; // te'amim incl. meteg (05BD)
/** Niqqud and other points U+05B0–U+05C7 except maqaf (05BE), paseq (05C0), sof pasuq (05C3), nun hafukha (05C6). */
const NIKUD = /[\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/g;
const PASEQ = /\s*\u05C0/g;

export const stripCantillation = (s: string): string => s.replace(TEAMIM, '').replace(PASEQ, '');
export const stripNikud = (s: string): string => stripCantillation(s).replace(NIKUD, '');
/** Hebrew consonants only (letters U+05D0–U+05EA). */
export const consonants = (s: string): string => s.replace(/[^א-ת]/g, '');

/** Comparison form of a word or phrase: consonants + nikud, no te'amim, no punctuation. */
export const normalize = (s: string): string =>
  stripCantillation(s)
    .replace(/[\u05BE]/g, ' ') // maqaf as a separator
    .replace(/[^\u05B0-\u05BC\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7א-ת ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export type TokenKind = 'word' | 'ketiv' | 'qere' | 'marker' | 'paseq';
export interface Token { text: string; kind: TokenKind }

const isMarker = (t: string) => /^\((?:פ|ס)\)$/.test(t) || /^\{(?:פ|ס)\}$/.test(t);
const hasPoints = (t: string) => /[\u05B0-\u05BC\u05C1\u05C2\u05C7]/.test(t);

/**
 * Split a pasuk (as stored in the WLC-based Sefaria version) into tokens.
 * Ketiv appears as an unpointed word followed by its pointed qere in [brackets];
 * (פ)/(ס) are parasha markers; ׀ is paseq.
 */
export function tokenize(verse: string): Token[] {
  const raw = verse.trim().split(/\s+/).filter(Boolean);
  const out: Token[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i]!;
    if (isMarker(t)) out.push({ text: t, kind: 'marker' });
    else if (t === '׀') out.push({ text: t, kind: 'paseq' });
    else if (/^\[.*\]$/.test(t)) out.push({ text: t, kind: 'qere' });
    else if (!hasPoints(t) && consonants(t).length > 0 && raw[i + 1]?.startsWith('[')) out.push({ text: t, kind: 'ketiv' });
    else out.push({ text: t, kind: 'word' });
  }
  return out;
}

/** Ordinary words only (used for word counts and openings). */
export const plainWords = (verse: string): string[] =>
  tokenize(verse).filter((t) => t.kind === 'word').map((t) => t.text);

/** Words as read (qere replaces ketiv), markers dropped. */
export const readingWords = (verse: string): string[] =>
  tokenize(verse)
    .filter((t) => t.kind === 'word' || t.kind === 'qere')
    .map((t) => (t.kind === 'qere' ? t.text.slice(1, -1) : t.text));

const TETRA = /י[\u0591-\u05C7]*ה[\u0591-\u05C7]*ו[\u0591-\u05C7]*ה/;
/** True if a token contains the Tetragrammaton. */
export const hasTetragrammaton = (w: string): boolean => TETRA.test(w);
/** True if the token is a form of the divine name Elohim (אלהים, אלהיך…). */
export const isElohim = (w: string): boolean => /^[והלבכמש]{0,2}אלהי/.test(consonants(w)) || /^[והלבכמש]{0,2}אלה$/.test(consonants(w));
export const isDivineName = (w: string): boolean => hasTetragrammaton(w) || isElohim(w);

/**
 * Display-only substitution of the divine names: the Tetragrammaton becomes ה׳
 * (keeping any prefix letters with their points), and Elohim is written with ק.
 * Never applied to stored data.
 */
export function substituteDivineNames(text: string): string {
  return text
    .split(/(\s+|\u05BE)/)
    .map((w) => {
      if (hasTetragrammaton(w)) {
        const idx = w.search(TETRA);
        // Keep trailing sof pasuq / punctuation after the name.
        const tail = (w.slice(idx).match(/[\u05C3:,.;]+$/) ?? [''])[0];
        return w.slice(0, idx) + 'ה׳' + tail;
      }
      if (isElohim(w)) {
        // replace the first ה after א-ל with ק
        return w.replace(/(א[\u0591-\u05C7]*ל[\u0591-\u05C7]*)ה/, '$1ק');
      }
      return w;
    })
    .join('');
}

const HEB_NUM: [number, string][] = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'], [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'],
  [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'], [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'],
  [3, 'ג'], [2, 'ב'], [1, 'א'],
];
/** Hebrew numeral (gematria) for 1–999, with ט״ו / ט״ז and geresh/gershayim. */
export function hebrewNumeral(n: number): string {
  let s = '';
  let r = n;
  for (const [v, l] of HEB_NUM) {
    while (r >= v) {
      if (r === 15) { s += 'טו'; r = 0; break; }
      if (r === 16) { s += 'טז'; r = 0; break; }
      s += l; r -= v;
    }
  }
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}
