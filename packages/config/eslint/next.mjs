/**
 * Front-end boundaries for the Next.js apps (`apps/web`, `apps/admin`).
 * Pattern fragments — see the note in `base.mjs`.
 */

/**
 * A feature is used through its two public entry points and no other way:
 *   `@/features/<name>`         client-safe surface
 *   `@/features/<name>/server`  server-only surface
 */
export const featureInternalsPatterns = [
  {
    group: [
      '@/features/*/components/*',
      '@/features/*/hooks/*',
      '@/features/*/services/*',
      '@/features/*/utils/*',
      '@/features/*/types',
    ],
    message:
      "A feature's internals are private. Import it as `@/features/<name>` or `@/features/<name>/server`.",
  },
];

/** HTTP libraries do not belong in the React tree. */
export const httpLibraryPaths = [
  {
    name: 'axios',
    message:
      'Use the shared API client in src/services rather than instantiating an HTTP library in the React tree.',
  },
];

/**
 * The browser and the React tree never talk to the network directly. Every
 * request goes through `src/services/**`, which is the single egress to
 * `apps/api`.
 */
export const networkGlobals = [
  {
    name: 'fetch',
    message:
      "Components do not call the network. Put the call in src/services (or the feature's services/) and import it from there.",
  },
  {
    name: 'XMLHttpRequest',
    message: 'Use the API client in src/services instead.',
  },
];

/** Where `networkGlobals` applies, relative to an app root. */
export const componentGlobs = [
  'src/app/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
  'src/features/*/components/**/*.{ts,tsx}',
  'src/features/*/hooks/**/*.{ts,tsx}',
  'src/stores/**/*.{ts,tsx}',
];
