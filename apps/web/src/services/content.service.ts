import type { ArticleCard, ArticleDetail, ArticleListQuery, ArticleReaction, ArticleReactions, Paginated } from '@hamdastan/types';

import { apiClient } from './api-client';

/** News and knowledge articles as the product reads them — live ones only; the API decides which. */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) => (options?.cookie ? { headers: { cookie: options.cookie } } : {});

export const contentService = {
  articles(query: ArticleListQuery, options?: ServerCall): Promise<Paginated<ArticleCard>> {
    return apiClient.get<Paginated<ArticleCard>>('/content/articles', { ...withCookie(options), query, cache: 'no-store' });
  },

  article(slug: string, options?: ServerCall): Promise<ArticleDetail> {
    return apiClient.get<ArticleDetail>(`/content/articles/${slug}`, { ...withCookie(options), cache: 'no-store' });
  },

  /** The reader's like or dislike; null takes it back. Answers the article's counts after it. */
  react(id: string, reaction: ArticleReaction | null): Promise<ArticleReactions> {
    return apiClient.put<ArticleReactions>(`/content/articles/${id}/reaction`, { reaction });
  },

  /** An admin's preview of an article in any status; the API checks the admin session it carries. */
  preview(id: string, options?: ServerCall): Promise<ArticleDetail> {
    return apiClient.get<ArticleDetail>(`/admin/content/articles/${id}/preview`, { ...withCookie(options), cache: 'no-store' });
  },
};
