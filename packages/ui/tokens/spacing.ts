/**
 * Spacing tokens.
 *
 * Tailwind v4 derives its whole spacing scale from a single `--spacing` base
 * (0.25rem), so `space(4)` and the `p-4` utility resolve to the same value by
 * construction. Use the utility in a `className`; use these only where a real
 * CSS length is required.
 */

/** One step on the Tailwind scale, as a CSS length. `space(4)` === `p-4`. */
export const space = (steps: number): string => `calc(var(--spacing) * ${steps})`;

/**
 * Named steps for the rhythm the app actually uses, so a layout says what it
 * means instead of repeating a magic number.
 */
export const spacing = {
  none: '0px',
  xs: space(1),
  sm: space(2),
  md: space(4),
  lg: space(6),
  xl: space(8),
  '2xl': space(12),
} as const;

/** Gap between a page's top-level sections. Matches `space-y-8` on a page. */
export const SECTION_GAP = spacing.xl;

/** Inner padding of a page shell. Matches `p-6`. */
export const PAGE_PADDING = spacing.lg;

export type SpacingToken = keyof typeof spacing;
