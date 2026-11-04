/** Applies settings to <html> (language, direction). */
import { store } from './store.ts';
export function applySettings() {
  const he = store.p.settings.uiLang === 'he';
  document.documentElement.lang = he ? 'he' : 'en';
  document.documentElement.dir = he ? 'rtl' : 'ltr';
}
