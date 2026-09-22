'use client';

import { useSyncExternalStore } from 'react';

/**
 * Theme store.
 *
 * Dark mode is a `.dark` class on <html>, matching the `@custom-variant dark`
 * declared in globals.css. The choice is persisted to localStorage and applied
 * by an inline script in the root layout before first paint, so there is no
 * flash of the wrong theme.
 *
 * This is deliberately not `next-themes`: the inline script plus this store
 * cover what the app needs, and keeping one mechanism avoids two sources of
 * truth fighting over the same class.
 */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME: Theme = 'dark';

/** Keep in sync with the inline script in `src/app/layout.tsx`. */
export function applyTheme(theme: Theme): void {
  const html = document.documentElement;
  html.classList.toggle('dark', theme === 'dark');
  html.setAttribute('data-theme', theme);
}

let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // Private mode / blocked storage — fall through to the default.
  }
  return DEFAULT_THEME;
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session.
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
