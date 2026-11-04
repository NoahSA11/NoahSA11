/**
 * Minimal types for the subset of Playwright used by scripts/ (the pre-installed
 * Playwright is loaded at runtime with require(); it is deliberately not an npm
 * dependency, so a second copy without a matching browser is never installed).
 */
declare module 'playwright' {
  export interface ElementHandle { click(): Promise<void> }
  export interface ConsoleMessage { type(): string; text(): string }
  export interface Page {
    goto(url: string): Promise<unknown>;
    reload(): Promise<unknown>;
    click(selector: string): Promise<void>;
    fill(selector: string, value: string): Promise<void>;
    $(selector: string): Promise<ElementHandle | null>;
    $$(selector: string): Promise<ElementHandle[]>;
    $$eval<R>(selector: string, fn: (els: Element[]) => R): Promise<R>;
    textContent(selector: string): Promise<string | null>;
    waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<ElementHandle | null>;
    waitForTimeout(ms: number): Promise<void>;
    waitForFunction(fn: string | (() => unknown), arg?: unknown, opts?: { timeout?: number }): Promise<unknown>;
    evaluate<R, A = unknown>(fn: (arg: A) => R | Promise<R>, arg?: A): Promise<R>;
    screenshot(opts: { path: string; fullPage?: boolean }): Promise<unknown>;
    on(event: 'pageerror', fn: (e: Error) => void): void;
    on(event: 'console', fn: (m: ConsoleMessage) => void): void;
    keyboard: { press(key: string): Promise<void> };
  }
  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<void>;
    setOffline(offline: boolean): Promise<void>;
  }
  export interface Browser {
    newContext(opts?: { viewport?: { width: number; height: number }; deviceScaleFactor?: number; serviceWorkers?: 'allow' | 'block' }): Promise<BrowserContext>;
    close(): Promise<void>;
  }
  export const chromium: { launch(opts?: { executablePath?: string }): Promise<Browser> };
}
