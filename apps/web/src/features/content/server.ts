/**
 * Content — server-only surface. Kept apart from `./index` so a client
 * component cannot pull `next/headers` into its bundle.
 */

export { getArticle, getArticlePreview } from './services/content.server';
