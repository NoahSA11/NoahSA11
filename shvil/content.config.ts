/**
 * Content configuration. The data layer is generic: a "corpus" is a list of
 * books, each with a base text (Hebrew), a translation, an optional
 * commentary keyed by the base text's [chapter][verse], and an optional alt
 * structure (e.g. Parasha) taken from the Sefaria index schema.
 *
 * Adding Nach or Mishnah later = add another corpus entry here (see NEXT.md).
 */
export const GCS = 'https://storage.googleapis.com/sefaria-export';

export interface VersionSpec {
  /** Sefaria versionTitle(s), exactly as in the export; the first one present for a book is used. */
  versionTitle: string | string[];
  language: 'Hebrew' | 'English';
  /** Licenses we accept. A version whose license is not in this list fails the fetch. */
  acceptLicenses: string[];
}

export interface BookSpec {
  /** Sefaria index title, e.g. "Genesis". */
  title: string;
  heTitle: string;
  /** Path under json/ in the Sefaria export, without language/version. */
  path: string;
  commentaryTitle?: string;
  commentaryPath?: string;
}

export interface CorpusSpec {
  id: string;
  base: VersionSpec;
  translation: VersionSpec;
  commentaryHe?: VersionSpec;
  commentaryEn?: VersionSpec;
  /** Name of the alt structure in the index schema used for lessons. */
  altStructure?: string;
  books: BookSpec[];
}

const PERMISSIVE = ['Public Domain', 'CC0', 'CC-BY'];
const RASHI_VER = "Pentateuch with Rashi's commentary by M. Rosenbaum and A.M. Silbermann, 1929-1934";

const torahBook = (title: string, heTitle: string): BookSpec => ({
  title,
  heTitle,
  path: `Tanakh/Torah/${title}`,
  commentaryTitle: `Rashi on ${title}`,
  commentaryPath: `Tanakh/Rishonim on Tanakh/Rashi/Torah/Rashi on ${title}`,
});

export const CORPORA: CorpusSpec[] = [
  {
    id: 'torah',
    base: { versionTitle: "Tanach with Ta'amei Hamikra", language: 'Hebrew', acceptLicenses: PERMISSIVE },
    translation: { versionTitle: 'The Holy Scriptures A New Translation JPS 1917', language: 'English', acceptLicenses: PERMISSIVE },
    commentaryHe: { versionTitle: [RASHI_VER, `${RASHI_VER.replace(', 1929-1934', '')} -- corrected vocalization`], language: 'Hebrew', acceptLicenses: PERMISSIVE },
    commentaryEn: { versionTitle: RASHI_VER, language: 'English', acceptLicenses: PERMISSIVE },
    altStructure: 'Parasha',
    books: [
      torahBook('Genesis', 'בראשית'),
      torahBook('Exodus', 'שמות'),
      torahBook('Leviticus', 'ויקרא'),
      torahBook('Numbers', 'במדבר'),
      torahBook('Deuteronomy', 'דברים'),
    ],
  },
];
