/**
 * Architecture boundaries, as reusable rule *fragments*.
 *
 * These are pattern lists rather than finished config blocks on purpose:
 * ESLint does not merge two config objects that set the same rule, the later
 * one simply wins. Composing the patterns into a single
 * `no-restricted-imports` per audience is what keeps a boundary from being
 * silently switched off by the block after it.
 *
 * Assembled in the repo-root `eslint.config.mjs`.
 */

/** Nothing may reach into another app's source tree. */
export const crossAppImportPatterns = [
  {
    group: [
      '@hamdastan/web',
      '@hamdastan/web/*',
      '@hamdastan/admin',
      '@hamdastan/admin/*',
      '@hamdastan/api',
      '@hamdastan/api/*',
    ],
    message:
      'Apps must not import each other. Move the shared code into packages/ (ui, types, validation, shared, config).',
  },
  {
    group: ['**/apps/*/src/**'],
    message:
      'Reaching into another app by relative path is forbidden. Share through a package under packages/.',
  },
];

/** Radix belongs behind the design-system wrappers, nowhere else. */
export const radixImportPatterns = [
  {
    group: ['radix-ui', '@radix-ui/*'],
    message:
      'Import Radix only inside packages/ui/primitives. Everywhere else use @hamdastan/ui, which applies the RTL defaults.',
  },
];
