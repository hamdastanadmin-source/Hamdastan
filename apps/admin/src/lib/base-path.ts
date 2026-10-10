/**
 * Where the panel is mounted: `https://hamdaastaan.ir/admin` in production,
 * `http://localhost:3001/admin` in development — the same path in both, so
 * nothing differs between them but the host.
 *
 * `next.config.ts` sets it as `basePath`, which `Link`, `redirect` and the
 * router add on their own. Anything they do not handle — a `next/image`
 * `src` from `public/`, a hard `window.location` navigation — goes through
 * `withBasePath`.
 */
export const BASE_PATH = '/admin';

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
