/**
 * Elevation.
 *
 * These point at Tailwind's built-in shadow scale rather than declaring a
 * second one, so `shadows.md` and the `shadow-md` utility can never drift.
 * Depth in this product is carried mainly by the surface ramp in `colors.ts`;
 * reach for a shadow only for something that genuinely floats.
 */

export const shadows = {
  none: 'none',
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

/** Ring used for keyboard focus. Pairs with the `--ring` colour token. */
export const FOCUS_RING = '0 0 0 2px hsl(var(--ring))';

export type ShadowToken = keyof typeof shadows;
