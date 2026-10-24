import type { WorldThemeId } from '@hamdastan/config';

/** Each theme's tint, as a whole class so the build sees it. The colours are tokens (`--world-*`). */
export const THEME_BAND: Record<WorldThemeId, string> = {
  neutral: 'bg-world-neutral',
  emerald: 'bg-world-emerald',
  amber: 'bg-world-amber',
  rose: 'bg-world-rose',
  sky: 'bg-world-sky',
  indigo: 'bg-world-indigo',
};
