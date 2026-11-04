/**
 * Fetch Sefaria snapshots at BUILD time and commit them to data/raw/.
 *
 * Source: the official Sefaria-Export dataset (index on GitHub, files on the
 * public `sefaria-export` GCS bucket). www.sefaria.org itself was not
 * reachable from the build environment; see DECISIONS.md.
 *
 * Polite: sequential requests, 1.5 s between requests, descriptive
 * User-Agent, files already on disk are not re-downloaded (use --force).
 * Every version's `license` field is checked against an allow-list; the
 * script fails if a license is missing or not accepted.
 *
 * Usage: npx tsx scripts/fetch-sefaria.ts [--force]
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CORPORA, GCS, type VersionSpec } from '../content.config.ts';

const ROOT = join(import.meta.dirname, '..');
const RAW = join(ROOT, 'data', 'raw');
const CACHE = join(ROOT, '.cache');
const UA = 'Shvil-content-build/1.0 (personal non-commercial Torah learning app; https://github.com/noahsa11/noahsa11)';
const BOOKS_INDEX = 'https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master/books.json';
const DELAY_MS = 1500;
const force = process.argv.includes('--force');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;

async function get(url: string): Promise<Buffer> {
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  for (let attempt = 1; ; attempt++) {
    lastRequest = Date.now();
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 4) throw e;
      console.warn(`  retry ${attempt} for ${url}: ${(e as Error).message}`);
      await sleep(2000 * 2 ** attempt);
    }
  }
}

interface BookEntry { title: string; language: string; versionTitle: string; json_url: string }

async function loadIndex(): Promise<BookEntry[]> {
  const f = join(CACHE, 'books.json');
  if (!existsSync(f) || force) {
    mkdirSync(CACHE, { recursive: true });
    console.log('Fetching Sefaria-Export books.json index…');
    writeFileSync(f, await get(BOOKS_INDEX));
  }
  return JSON.parse(readFileSync(f, 'utf8')).books;
}

interface ManifestEntry {
  file: string;
  kind: 'text' | 'schema';
  title: string;
  language?: string;
  versionTitle?: string;
  versionTitleInHebrew?: string;
  versionSource?: string;
  license?: string;
  url: string;
  sha256: string;
  bytes: number;
  fetchedAt: string;
}

const manifestPath = join(ROOT, 'data', 'manifest.json');
const manifest: { source: string; exportDate?: string; entries: ManifestEntry[] } = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { source: 'Sefaria-Export (https://github.com/Sefaria/Sefaria-Export)', entries: [] };

function record(e: ManifestEntry) {
  manifest.entries = manifest.entries.filter((x) => x.file !== e.file);
  manifest.entries.push(e);
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function fetchFile(rel: string, url: string): Promise<{ buf: Buffer; fresh: boolean }> {
  const out = join(RAW, rel);
  if (existsSync(out) && !force) return { buf: readFileSync(out), fresh: false };
  console.log(`GET ${url}`);
  const buf = await get(url);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buf);
  return { buf, fresh: true };
}

async function fetchVersion(index: BookEntry[], title: string, spec: VersionSpec, rel: string) {
  const titles = Array.isArray(spec.versionTitle) ? spec.versionTitle : [spec.versionTitle];
  const entry = titles.map((vt) => index.find((b) => b.title === title && b.language === spec.language && b.versionTitle === vt)).find(Boolean);
  if (!entry) throw new Error(`Version not found in Sefaria-Export index: ${title} / ${spec.language} / ${spec.versionTitle}`);
  const { buf, fresh } = await fetchFile(rel, entry.json_url);
  const d = JSON.parse(buf.toString('utf8'));
  if (typeof d.license !== 'string' || !d.license) throw new Error(`No license field for ${title} ${spec.versionTitle} — refusing to use it.`);
  if (!spec.acceptLicenses.includes(d.license)) throw new Error(`License "${d.license}" for ${title} ${spec.versionTitle} is not in the accepted list.`);
  const prev = manifest.entries.find((x) => x.file === rel);
  record({
    file: rel, kind: 'text', title, language: spec.language,
    versionTitle: d.versionTitle, versionTitleInHebrew: d.versionTitleInHebrew, versionSource: d.versionSource,
    license: d.license, url: entry.json_url, sha256: sha(buf), bytes: buf.length,
    fetchedAt: fresh || !prev ? new Date().toISOString() : prev.fetchedAt,
  });
}

async function main() {
  const index = await loadIndex();
  try {
    manifest.exportDate = (await get(`${GCS}/last_export.txt`)).toString('utf8').trim();
  } catch { /* keep previous */ }
  for (const corpus of CORPORA) {
    for (const book of corpus.books) {
      const dir = `${corpus.id}/${book.title}`;
      await fetchVersion(index, book.title, corpus.base, `${dir}/base.he.json`);
      await fetchVersion(index, book.title, corpus.translation, `${dir}/translation.en.json`);
      if (book.commentaryTitle) {
        if (corpus.commentaryHe) await fetchVersion(index, book.commentaryTitle, corpus.commentaryHe, `${dir}/commentary.he.json`);
        if (corpus.commentaryEn) await fetchVersion(index, book.commentaryTitle, corpus.commentaryEn, `${dir}/commentary.en.json`);
      }
      const schemaUrl = `${GCS}/schemas/${encodeURIComponent(book.title)}.json`;
      const rel = `${dir}/schema.json`;
      const { buf, fresh } = await fetchFile(rel, schemaUrl);
      const prev = manifest.entries.find((x) => x.file === rel);
      record({ file: rel, kind: 'schema', title: book.title, url: schemaUrl, sha256: sha(buf), bytes: buf.length,
        fetchedAt: fresh || !prev ? new Date().toISOString() : prev.fetchedAt });
    }
  }
  manifest.entries.sort((a, b) => a.file.localeCompare(b.file));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Manifest: ${manifest.entries.length} entries → data/manifest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
