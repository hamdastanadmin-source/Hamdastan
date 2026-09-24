import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

import { crossAppImportPatterns, radixImportPatterns } from "@hamdastan/config/eslint/base";
import {
  componentGlobs,
  featureInternalsPatterns,
  httpLibraryPaths,
  networkGlobals,
} from "@hamdastan/config/eslint/next";
import {
  backendImportPatterns,
  controllerLayerPatterns,
  routeLayerPatterns,
} from "@hamdastan/config/eslint/node";

/**
 * One flat config for the whole monorepo.
 *
 * The architecture boundaries live in `packages/config/eslint` as pattern
 * lists; this file decides who each one applies to. They are composed into a
 * single `no-restricted-imports` per audience because ESLint does not merge
 * two blocks that set the same rule — the later block replaces the earlier
 * one, which would quietly disable a boundary.
 */

const FRONTEND = ["apps/web", "apps/admin"];

/** `no-restricted-imports`, built from the fragments that apply. */
const restrictImports = (patterns, paths = []) => [
  "error",
  { patterns, ...(paths.length ? { paths } : {}) },
];

const eslintConfig = defineConfig([
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/dist/**",
    "**/node_modules/**",
    "**/next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),

  // ── TypeScript baseline, every workspace ────────────────────────────────
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [...tseslint.configs.recommended],
  },

  // ── Next.js rules for the front-end apps and the design system ──────────
  {
    files: ["apps/web/**/*.{ts,tsx}", "apps/admin/**/*.{ts,tsx}", "packages/ui/**/*.{ts,tsx}"],
    extends: [...nextVitals, ...nextTs],
    settings: { next: { rootDir: FRONTEND } },
  },

  // ── Import boundaries, one block per audience ───────────────────────────
  {
    name: "hamdastan/boundaries-shared-packages",
    files: ["packages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictImports([
        ...crossAppImportPatterns,
        ...radixImportPatterns,
      ]),
    },
  },
  {
    // The one place Radix may be imported.
    name: "hamdastan/boundaries-ui-primitives",
    files: ["packages/ui/primitives/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictImports([...crossAppImportPatterns]),
    },
  },
  {
    name: "hamdastan/boundaries-frontend",
    files: FRONTEND.map((app) => `${app}/**/*.{ts,tsx}`),
    rules: {
      "no-restricted-imports": restrictImports(
        [...crossAppImportPatterns, ...radixImportPatterns, ...featureInternalsPatterns],
        httpLibraryPaths
      ),
    },
  },
  {
    name: "hamdastan/no-network-in-components",
    files: FRONTEND.flatMap((app) => componentGlobs.map((glob) => `${app}/${glob}`)),
    rules: { "no-restricted-globals": ["error", ...networkGlobals] },
  },

  // ── Backend layering. Most specific last, each repeating the general
  //    patterns so the block it overrides loses nothing. ──────────────────
  {
    name: "hamdastan/boundaries-api",
    files: ["apps/api/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports([
        ...crossAppImportPatterns,
        ...backendImportPatterns,
      ]),
    },
  },
  {
    name: "hamdastan/api-controllers-reach-services-only",
    files: ["apps/api/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": restrictImports([
        ...crossAppImportPatterns,
        ...backendImportPatterns,
        ...controllerLayerPatterns,
      ]),
    },
  },
  {
    name: "hamdastan/api-routes-reach-controllers-only",
    files: ["apps/api/**/*.routes.ts"],
    rules: {
      "no-restricted-imports": restrictImports([
        ...crossAppImportPatterns,
        ...backendImportPatterns,
        ...routeLayerPatterns,
      ]),
    },
  },
  {
    // A repository port starts empty: its methods are added as the module's
    // service grows real use cases. That is the intended state, not a smell.
    name: "hamdastan/empty-repository-ports",
    files: ["apps/api/src/modules/**/*.repository.ts"],
    rules: { "@typescript-eslint/no-empty-object-type": "off" },
  },
]);

export default eslintConfig;
