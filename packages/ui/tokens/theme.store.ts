'use client';

import { useSyncExternalStore } from 'react';

import { DEFAULT_THEME, THEME_STORAGE_KEY, applyTheme, readStoredTheme, type Theme } from './theme';

/**
 * Theme store.
 *
 * Deliberately not `next-themes`: the pre-paint script in `theme.ts` plus
 * this store cover what the app needs, and keeping one mechanism avoids two
 * sources of truth fighting over the same class.
 */

let listeners: Array<() => void> = [];

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
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
  return useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);
}

export type { Theme };
