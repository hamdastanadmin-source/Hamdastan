/**
 * Which token set is live.
 *
 * `tokens.css` declares both themes; this file decides which one applies, by
 * toggling `.dark` on <html>. No React here on purpose — the root layout is a
 * server component and needs `THEME_INIT_SCRIPT`, and the pre-paint script
 * and `applyTheme` have to agree exactly, so they live side by side.
 *
 * The React store that components subscribe to is in `theme.store.ts`.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME: Theme = 'dark';

export function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.setAttribute('data-theme', theme);
}

/** The stored choice, or the default when storage is empty or blocked. */
export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  return DEFAULT_THEME;
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong
 * theme. Inlined as a string because it has to execute before any bundle
 * loads. The markup ships with the default theme already applied, so this
 * only has to undo it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.setAttribute('data-theme','light')}}catch(e){}})()`;
