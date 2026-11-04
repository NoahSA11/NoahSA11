/**
 * End-to-end check through the real UI (needs `npm run preview` running):
 *  1. play a full parsha lesson by clicking (learn card → 10 questions → done),
 *     reloading the page mid-lesson (including while feedback is showing);
 *  2. go offline (Playwright offline context) and confirm the app, another book
 *     and a new lesson still load from the service worker cache.
 * Usage: npx tsx scripts/e2e.ts
 */
import type { Page } from 'playwright';
import { answer, BASE, launch, TODAY, watchErrors } from './pw.ts';

const assert = (c: unknown, m: string) => { if (!c) throw new Error(`E2E FAILED: ${m}`); console.log(`  ✓ ${m}`); };
const progress = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('shvil.progress') ?? 'null'));

const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errors: string[] = [];
watchErrors(p, errors);

console.log('Lesson click path');
await p.goto(`${BASE}?today=${TODAY}#/`);
await p.waitForSelector('.node.open');
await p.click('.node.open');
await p.waitForSelector('.learn');
assert((await p.$$('.learn .pasuk')).length >= 3, 'learn card shows the opening pesukim');
await p.reload();
await p.waitForSelector('.learn');
assert(true, 'learn card survives a reload');
await p.click('.learn .btn.primary');

let n = 0;
for (;;) {
  const done = await p.$('.done');
  if (done) break;
  await answer(p, n !== 2); // one deliberate mistake
  if (n === 3) {
    await p.reload(); // reload while feedback is showing
    await p.waitForSelector('.feedback');
    assert(true, 'feedback state restored after reload');
  }
  const link = await p.$('.feedback a.sefaria');
  assert(!!link, `question ${n + 1}: feedback shows a Sefaria link`);
  await p.click('#continue');
  n++;
  if (n === 6) {
    await p.reload(); // reload between questions
    await p.waitForSelector('.qcard');
    const a = (await progress(p)).active;
    assert(a.index === 6, 'mid-lesson reload resumes at question 7');
  }
  if (n > 20) throw new Error('lesson did not end');
}
const pr = await progress(p);
assert(n === 10, `answered 10 questions (got ${n})`);
assert(pr.parshiyot.Bereshit?.completed === 1, 'parsha marked completed');
assert(pr.unlocked.Genesis === 1, 'next parsha unlocked');
assert(pr.xp > 0 && pr.streak.current === 1, 'XP and streak recorded');
assert(Object.keys(pr.srs).length === 10, 'all 10 items scheduled for spaced repetition');
const due = Object.values(pr.srs as Record<string, { due: string }>).filter((x) => x.due <= TODAY).length;
assert(due === 1, 'the missed item is due for review today');

console.log('Offline');
await p.goto(`${BASE}?today=${TODAY}#/`);
await p.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 15000 });
// wait for the background content precache to finish
await p.waitForFunction(async () => {
  const keys = await caches.keys();
  const c = await caches.open(keys.find((k) => k.startsWith('shvil-'))!);
  return (await c.keys()).filter((r) => r.url.includes('/content/')).length >= 12;
}, undefined, { timeout: 30000 });
await ctx.setOffline(true);
await p.reload();
await p.waitForSelector('.node');
assert(true, 'app shell loads offline');
await p.goto(`${BASE}?today=${TODAY}#/book/Deuteronomy`);
await p.waitForSelector('.node.open');
await p.click('.node.open');
await p.waitForSelector('.learn');
assert(true, 'a different book (Deuteronomy) loads offline');
await p.click('.learn .btn.primary');
await answer(p, true);
assert(true, 'questions answerable offline');
await p.goto(`${BASE}?today=${TODAY}#/daily`);
await p.waitForSelector('.page .btn');
assert(true, 'daily challenge builds offline');
await b.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('E2E PASSED');
