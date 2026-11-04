import { describe, expect, it } from 'vitest';
import { consonants, hebrewNumeral, isDivineName, normalize, plainWords, readingWords, stripCantillation, substituteDivineNames, tokenize } from '../src/engine/hebrew.ts';
import { loadRawSource } from '../scripts/raw-source.ts';

const raw = loadRawSource();

describe('tokenize', () => {
  it('marks ketiv/qere (Genesis 8:17: הוצא [הַיְצֵא])', () => {
    const t = tokenize(raw.verse('Genesis', 8, 17)!);
    const k = t.findIndex((x) => x.kind === 'ketiv');
    expect(t[k]!.text).toBe('הוצא');
    expect(t[k + 1]!.kind).toBe('qere');
    expect(readingWords(raw.verse('Genesis', 8, 17)!)).toContain('הַיְצֵ֣א');
    expect(plainWords(raw.verse('Genesis', 8, 17)!)).not.toContain('הוצא');
  });
  it('handles a ketiv with two qere words (Genesis 30:11: בגד [בָּא] [גָד])', () => {
    const t = tokenize(raw.verse('Genesis', 30, 11)!);
    expect(t.filter((x) => x.kind === 'qere')).toHaveLength(2);
    expect(t.filter((x) => x.kind === 'ketiv').map((x) => x.text)).toEqual(['בגד']);
  });
  it('treats parenthetical (פ)/(ס) as markers and ׀ as paseq', () => {
    const t = tokenize(raw.verse('Genesis', 1, 5)!);
    expect(t.at(-1)).toEqual({ text: '(פ)', kind: 'marker' });
    expect(t.some((x) => x.kind === 'paseq')).toBe(true);
  });
});

describe('normalize & display', () => {
  it('strips te\'amim but keeps nikud', () => {
    expect(stripCantillation('בְּרֵאשִׁ֖ית')).toBe('בְּרֵאשִׁית');
    expect(normalize('הָאָֽרֶץ׃')).toBe(normalize('הָאָרֶץ'));
    expect(consonants('הָאָֽרֶץ׃')).toBe('הארץ');
  });
  it('substitutes divine names for display only', () => {
    const v = raw.verse('Genesis', 2, 4)!;
    const s = substituteDivineNames(stripCantillation(v));
    expect(s).toContain('ה׳');
    expect(s).toContain('אֱלֹקִים');
    expect(raw.verse('Genesis', 2, 4)).toBe(v); // stored text untouched
    expect(substituteDivineNames('לַיהוָה')).toBe('לַה׳');
    expect(isDivineName('אֱלֹהִים')).toBe(true);
    expect(isDivineName('הָאָרֶץ')).toBe(false);
  });
  it('writes Hebrew numerals', () => {
    expect(hebrewNumeral(1)).toBe('א׳');
    expect(hebrewNumeral(15)).toBe('ט״ו');
    expect(hebrewNumeral(16)).toBe('ט״ז');
    expect(hebrewNumeral(50)).toBe('נ׳');
    expect(hebrewNumeral(34)).toBe('ל״ד');
  });
});
