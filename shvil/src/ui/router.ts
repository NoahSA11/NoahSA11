/** Hash router. */
type Handler = (root: HTMLElement, params: string[]) => void | Promise<void>;
const routes: [RegExp, Handler][] = [];
export const route = (re: RegExp, fn: Handler) => routes.push([re, fn]);
export function go(hash: string) {
  if (location.hash === hash) void dispatch();
  else location.hash = hash;
}
let rootEl: HTMLElement;
export function startRouter(root: HTMLElement) {
  rootEl = root;
  window.addEventListener('hashchange', () => void dispatch());
  void dispatch();
}
export const onNavigate: (() => void)[] = [];
async function dispatch() {
  const hash = location.hash || '#/';
  for (const f of onNavigate) f();
  for (const [re, fn] of routes) {
    const m = re.exec(hash);
    if (m) {
      await fn(rootEl, m.slice(1));
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}
