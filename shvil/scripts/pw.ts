/** Shared Playwright helpers for screenshots.ts and e2e.ts (uses the pre-installed Playwright). */
import { createRequire } from 'node:module';
import type { Browser, Page } from 'playwright';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright') as typeof import('playwright');
export const BASE = process.env.SHVIL_URL ?? 'http://localhost:4173/';
export const TODAY = '2026-11-04';

export const launch = (): Promise<Browser> => chromium.launch();

export function watchErrors(p: Page, errors: string[]) {
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
}

interface AnyQ { id: string; type: string; answerIndex: number; options: unknown[]; shuffled: number[] }

/** Looks up the active question in the shipped bank (so tests can answer right or wrong on purpose). */
export async function currentQuestion(p: Page): Promise<AnyQ> {
  const id = await p.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('shvil.progress')!).active;
    return a.questionIds[a.index] as string;
  });
  const bank = await p.evaluate(async (f) => (await fetch(f)).json(), `./content/bank-${id.split(':')[0]}.json`);
  return bank.questions.find((x: AnyQ) => x.id === id);
}

/** Answer the current question through the real UI: correctly if `right`, otherwise wrongly. */
export async function answer(p: Page, right: boolean): Promise<AnyQ> {
  await p.waitForSelector('.qcard');
  const q = await currentQuestion(p);
  if (q.type === 'order') {
    const picked: number[] = [];
    // Wrong = tap in display order (the shuffle is never the identity).
    const sequence = right ? q.shuffled.map((_, pos) => q.shuffled.indexOf(pos)) : q.shuffled.map((_, i) => i);
    for (const di of sequence) {
      const notChosen = q.shuffled.map((_, i) => i).filter((i) => !picked.includes(i));
      const pool = await p.$$('.order-pool .order-item');
      await pool[notChosen.indexOf(di)]!.click();
      picked.push(di);
    }
    await p.click('.qcard .btn.primary');
  } else {
    const i = right ? q.answerIndex : (q.answerIndex + 1) % q.options.length;
    await p.click(`.options .option:nth-child(${i + 1})`);
  }
  await p.waitForSelector('.feedback');
  return q;
}
