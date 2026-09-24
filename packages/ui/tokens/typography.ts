/**
 * Type tokens.
 *
 * The families resolve through `--font-family`, which `tokens.css` binds to
 * the Yekan Bakh face loaded by each app's root layout. Reading them from
 * here means a chart label and a paragraph use the same font without either
 * one naming it.
 */

/**
 * Persian UI face. The literal fallback stack is the one place it is written
 * down, because `next/font` needs a value before the CSS variable exists.
 */
export const FONT_FAMILY =
  "var(--font-yekan-bakh, 'Yekan Bakh'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const FONT_FAMILY_MONO = "'Courier New', 'Monaco', 'Menlo', monospace";

export const fontFamily = {
  sans: 'var(--font-family)',
  mono: 'var(--font-family-mono)',
} as const;

/**
 * Persian needs more breathing room than Latin at the same size, which is
 * why these run looser than Tailwind's defaults.
 */
export const lineHeight = {
  tight: 'var(--leading-tight)',
  normal: 'var(--leading-normal)',
  relaxed: 'var(--leading-relaxed)',
} as const;

/**
 * Semantic roles, mapped to the Tailwind size utility that renders them.
 * `2xs` is the project's own step below Tailwind's `xs`.
 */
export const textRole = {
  pageTitle: 'text-2xl',
  sectionTitle: 'text-lg',
  body: 'text-base',
  secondary: 'text-sm',
  caption: 'text-xs',
  micro: 'text-2xs',
} as const;

/**
 * Reads the resolved family at runtime, for APIs that need a real string
 * rather than a `var()` reference (canvas, chart libraries).
 */
export function resolveFontFamily(): string {
  if (typeof window === 'undefined') return FONT_FAMILY;
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--font-family')
      .trim() || FONT_FAMILY
  );
}

export type TextRole = keyof typeof textRole;
