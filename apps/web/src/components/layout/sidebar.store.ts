'use client';

import { useSyncExternalStore } from 'react';

/**
 * Whether the sidebar is collapsed to icons, remembered across visits.
 *
 * Read through `useSyncExternalStore` rather than held in React state seeded
 * from `localStorage`. The difference matters: the server has no way to know
 * what this browser stored, so seeding state during render makes the server
 * and the client render different HTML and hydration fails — which shows up as
 * a blank page with "a client-side exception has occurred", and only for the
 * people who had collapsed the sidebar before.
 *
 * `useSyncExternalStore` is the API for exactly this. React renders the server
 * snapshot, then re-renders with the browser's once hydration is done. Same
 * shape as the theme store in `@hamdastan/ui/tokens`.
 */

const STORAGE_KEY = 'sidebar-collapsed';

let listeners: Array<() => void> = [];

/** This session's value. Also the fallback when storage is unavailable. */
let isCollapsed = false;
let hasReadStorage = false;

function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function getSnapshot(): boolean {
  // Read once: `getSnapshot` runs on every render, and the answer only changes
  // when this module changes it.
  if (!hasReadStorage) {
    try {
      isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      // Private mode, or storage blocked. The sidebar starts expanded and the
      // toggle still works for this session.
    }
    hasReadStorage = true;
  }
  return isCollapsed;
}

/** The server cannot know what this browser stored, so it renders expanded. */
function getServerSnapshot(): boolean {
  return false;
}

function toggleCollapse(): void {
  isCollapsed = !getSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, String(isCollapsed));
  } catch {
    // Non-fatal: the choice just will not survive a reload.
  }
  listeners.forEach((listener) => listener());
}

export function useSidebar(): { isCollapsed: boolean; toggleCollapse: () => void } {
  return {
    isCollapsed: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
    toggleCollapse,
  };
}
