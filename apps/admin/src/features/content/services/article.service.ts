import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';

import type { AdminArticleDetail } from '@hamdastan/types';

import { adminContentService, HttpError } from '@/services';

/**
 * An article read on the server, with the request's admin cookie, so the
 * editor opens complete. A missing one is the 404 page; any other failure
 * is left to the error boundary.
 */
export async function getArticle(id: string): Promise<AdminArticleDetail> {
  const cookie = (await cookies()).toString();
  try {
    return await adminContentService.article(id, { cookie });
  } catch (error) {
    if (error instanceof HttpError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }
}
