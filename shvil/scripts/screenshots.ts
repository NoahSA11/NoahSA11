/**
 * Playwright screenshots at 390x844 and 1280x800 of every screen and question type.
 * Requires a running preview server (npm run preview). Output: test-results/shots/ and 3 in docs/.
 * Usage: npx tsx scripts/screenshots.ts
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { answer, BASE, launch, TODAY, watchErrors } from './pw.ts';

const OUT = join(import.meta.dirname, '..', 'test-results', 'shots');
const DOCS = join(import.meta.dirname, '..', 'docs');
mkdirSync(OUT, { recursive: true });
mkdirSync(DOCS, { recursive: true });

const sizes = [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }];
const types = ['cloze', 'order', 'where', 'rashi', 'firstlast'];

const patch = (p: Page, f: string) => p.evaluate((f) => {
  const pr = JSON.parse(localStorage.getItem('shvil.progress')!);
  new Function('pr', f)(pr);
  localStorage.setItem('shvil.progress', JSON.stringify(pr));
}, f);

const b = await launch();
const errors: string[] = [];
for (const sz of sizes) {
  const ctx = await b.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  watchErrors(p, errors);
  const shot = (n: string, full = false) => p.screenshot({ path: join(OUT, `${sz.name}-${n}.png`), fullPage: full });
  const open = async (hash: string, sel: string) => { await p.goto(`${BASE}?today=${TODAY}${hash}`); await p.reload(); await p.waitForSelector(sel); await p.waitForTimeout(200); };

  await open('#/', '.node');
  await shot('path');
  await p.click('.node.open');
  await p.waitForSelector('.learn');
  await shot('learn', true);

  // One question of each type from Parashat Noach, run through the real session UI.
  const bank = await p.evaluate(async () => (await fetch('./content/bank-Genesis.json')).json());
  const ids = types.map((t) => bank.questions.find((q: { type: string; parsha: string }) => q.type === t && q.parsha === 'Noach').id);
  await patch(p, `pr.active = { kind: 'lesson', key: 'Noach', book: 'Genesis', questionIds: ${JSON.stringify(ids)}, index: 0, hearts: 5, results: ${JSON.stringify(ids.map(() => null))}, learnSeen: true, startedAt: '${TODAY}' }`);
  await open('#/session', '.qcard');
  for (let i = 0; i < types.length; i++) {
    await p.waitForSelector('.qcard');
    await shot(`q-${types[i]}`, true);
    await answer(p, i % 2 === 0);
    await shot(`feedback-${types[i]}`, true);
    await p.click('#continue');
  }
  await p.waitForSelector('.done');
  await shot('lesson-done');

  await open('#/settings', '.setting');
  await p.click('.switch >> nth=0'); // cantillation on
  await shot('settings', true);
  await patch(p, `pr.settings.divineNames = 'substituted'`);
  await open('#/', '.node');
  await p.click('.node.open');
  await p.waitForSelector('.learn');
  await shot('learn-cantillation-substituted', true);
  await p.click('.session-top .btn');

  await open('#/review', '.page');
  await shot('review');
  await open('#/daily', '.page .btn, .page pre');
  await shot('daily');
  await open('#/credits', 'table');
  await shot('credits', true);

  await patch(p, `pr.settings.uiLang = 'en'; pr.settings.cantillation = false; pr.settings.divineNames = 'written'`);
  await open('#/', '.node');
  await shot('path-en');
  await ctx.close();
}
await b.close();
for (const [src, dst] of [['mobile-path', 'path-map'], ['mobile-feedback-cloze', 'feedback'], ['desktop-q-rashi', 'rashi-question']]) copyFileSync(join(OUT, `${src}.png`), join(DOCS, `${dst}.png`));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Screenshots written to ${OUT} (and 3 copied to docs/).`);
