/**
 * App-local infrastructure for the admin panel.
 * Reusable helpers belong in `@hamdastan/shared`.
 *
 * `server-request.ts` is deliberately not re-exported here: it reads
 * `next/headers`, so it is imported directly by the server-only side of a
 * feature rather than through a barrel a client component might touch.
 */

export {};
