import '@fontsource/frank-ruhl-libre/hebrew-400.css';
import '@fontsource/frank-ruhl-libre/hebrew-700.css';
import '@fontsource/frank-ruhl-libre/latin-400.css';
import '@fontsource/frank-ruhl-libre/latin-700.css';
import './styles.css';
import { h } from './ui/dom.ts';
import { t } from './ui/i18n.ts';
import { onNavigate, route, startRouter } from './ui/router.ts';
import { renderPath } from './ui/screens/path.ts';
import { renderCredits, renderDaily, renderReview, renderSettings } from './ui/screens/misc.ts';
import { clearKeys, renderSession } from './ui/session.ts';
import { store } from './ui/store.ts';
import { applySettings } from './ui/theme.ts';

store.init();
applySettings();

const app = document.getElementById('app')!;
const nav = document.getElementById('nav')!;
const main = h('main', { id: 'main', tabindex: '-1' });
app.replaceChildren(main);

function drawNav() {
  const cur = location.hash || '#/';
  const item = (href: string, label: string, icon: string) => h('a', { href, class: `nav-i ${cur === href || (href === '#/' && cur.startsWith('#/book')) ? 'on' : ''}`, 'aria-current': cur === href ? 'page' : undefined },
    h('span', { class: 'nav-ic', 'aria-hidden': 'true' }, icon), h('span', {}, label));
  nav.replaceChildren(
    item('#/', t('path'), '⟡'), item('#/review', t('review'), '↻'), item('#/daily', t('daily'), '☀'), item('#/settings', t('settings'), '⚙'), item('#/credits', t('credits').split(' ')[0]!, 'ⓘ'));
  document.title = `${t('appName')} · ${t('tagline')}`;
  document.body.classList.toggle('in-session', cur === '#/session');
}
onNavigate.push(drawNav, clearKeys);

route(/^#\/$/, (r) => renderPath(r, []));
route(/^#\/book\/(.+)$/, renderPath);
route(/^#\/session$/, renderSession);
route(/^#\/review$/, renderReview);
route(/^#\/daily$/, renderDaily);
route(/^#\/settings$/, (r) => { renderSettings(r); drawNav(); });
route(/^#\/credits$/, renderCredits);
startRouter(main);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW registration failed', e)));
}
