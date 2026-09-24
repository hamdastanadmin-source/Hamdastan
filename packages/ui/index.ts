/**
 * The design system's public surface.
 *
 * Apps import from here. Nothing outside this package reaches into
 * `primitives/` — those are wrapped so that RTL, theming and the token set
 * are applied in exactly one place.
 *
 *   @hamdastan/ui           components, patterns and icons (this file)
 *   @hamdastan/ui/tokens    design values for TypeScript consumers
 *
 * Deliberately not re-exported here: `tokens` (importing a token should not
 * pull the whole component library in) and `tokens/theme.store` (a client
 * module that server components must be able to avoid).
 */

export * from './components';
export * from './icons';
export * from './patterns/SectionHeader';
export * from './patterns/ThemeToggle';
