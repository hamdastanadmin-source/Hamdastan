import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { ArticleDetail } from '@hamdastan/types';

import { contentService, HttpError } from '@/services';

/** Articles read on the server with the request's own cookies, so the page opens complete. */

const cookie = async () => (await cookies()).toString();

/** A 404 or a malformed address is the 404 page — never a hint that something exists. */
function missing(error: unknown): never {
  if (error instanceof HttpError && [400, 401, 403, 404].includes(error.status)) notFound();
  throw error;
}

export async function getArticle(slug: string): Promise<ArticleDetail> {
  return contentService.article(slug, { cookie: await cookie() }).catch(missing);
}

/** An admin's preview: the admin's own session cookie goes with it, and the API decides. */
export async function getArticlePreview(id: string): Promise<ArticleDetail> {
  return contentService.preview(id, { cookie: await cookie() }).catch(missing);
}
