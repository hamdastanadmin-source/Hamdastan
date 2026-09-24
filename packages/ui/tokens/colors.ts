/**
 * Colour tokens for TypeScript consumers.
 *
 * These are *references* to the custom properties declared in `tokens.css`,
 * not copies of them. A chart, a canvas or an inline style reads a colour
 * from here and automatically follows the active theme; changing a colour
 * still means editing exactly one place — `tokens.css`.
 *
 * In a `className`, prefer the Tailwind utility (`bg-primary`) over these.
 */

const hsl = (token: string) => `hsl(var(--${token}))`;

export const colors = {
  background: hsl('background'),
  foreground: hsl('foreground'),

  card: hsl('card'),
  cardForeground: hsl('card-foreground'),
  popover: hsl('popover'),
  popoverForeground: hsl('popover-foreground'),

  primary: hsl('primary'),
  primaryForeground: hsl('primary-foreground'),
  secondary: hsl('secondary'),
  secondaryForeground: hsl('secondary-foreground'),
  muted: hsl('muted'),
  mutedForeground: hsl('muted-foreground'),
  accent: hsl('accent'),
  accentForeground: hsl('accent-foreground'),

  border: hsl('border'),
  input: hsl('input'),
  ring: hsl('ring'),

  destructive: hsl('destructive'),
  destructiveForeground: hsl('destructive-foreground'),
  success: hsl('success'),
  successForeground: hsl('success-foreground'),
  warning: hsl('warning'),
  warningForeground: hsl('warning-foreground'),
  error: hsl('error'),
  errorForeground: hsl('error-foreground'),
  info: hsl('info'),
  infoForeground: hsl('info-foreground'),
} as const;

/** The brand ramp. Every step derives from `--brand-hue` in tokens.css. */
export const brand = {
  50: hsl('brand-50'),
  100: hsl('brand-100'),
  200: hsl('brand-200'),
  300: hsl('brand-300'),
  400: hsl('brand-400'),
  500: hsl('brand-500'),
  600: hsl('brand-600'),
} as const;

/** Elevation surfaces, 0 (page) through 4 (highest). */
export const surfaces = {
  0: hsl('surface-0'),
  1: hsl('surface-1'),
  2: hsl('surface-2'),
  3: hsl('surface-3'),
  4: hsl('surface-4'),
} as const;

/** Categorical palette for data visualisation. */
export const chartColors = [
  hsl('chart-1'),
  hsl('chart-2'),
  hsl('chart-3'),
  hsl('chart-4'),
  hsl('chart-5'),
] as const;

export type ColorToken = keyof typeof colors;
export type BrandStep = keyof typeof brand;
export type SurfaceLevel = keyof typeof surfaces;
