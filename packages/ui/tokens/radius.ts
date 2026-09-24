/**
 * Corner radii.
 *
 * All four derive from `--radius` in `tokens.css`, so changing that one value
 * rounds the whole product consistently.
 */

export const radius = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  full: '9999px',
} as const;

/** The base every other step is computed from. */
export const RADIUS_BASE = 'var(--radius)';

export type RadiusToken = keyof typeof radius;
