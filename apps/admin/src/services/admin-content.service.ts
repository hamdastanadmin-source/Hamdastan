import type {
  AdminArticleDetail,
  AdminArticleHistoryEntry,
  AdminArticleListQuery,
  AdminArticleSummary,
  ArticleInput,
  ArticleStatusInput,
  ContentIndexItem,
  ContentIndexQuery,
  Paginated,
} from '@hamdastan/types';

import { apiClient } from './api-client';

/** Content's routes in the panel — the central index and the articles — named once. */

const base = '/admin/content';

export const adminContentService = {
  index(query: ContentIndexQuery) {
    return apiClient.get<Paginated<ContentIndexItem>>(base, { query: { ...query, q: query.q || undefined }, cache: 'no-store' });
  },

  articles(query: AdminArticleListQuery) {
    return apiClient.get<Paginated<AdminArticleSummary>>(`${base}/articles`, { query: { ...query, q: query.q || undefined }, cache: 'no-store' });
  },

  /** On the server, pass the request's cookie through. */
  article(id: string, options?: { cookie?: string }) {
    return apiClient.get<AdminArticleDetail>(`${base}/articles/${id}`, {
      ...(options?.cookie ? { headers: { cookie: options.cookie } } : {}),
      cache: 'no-store',
    });
  },

  create(input: ArticleInput) {
    return apiClient.post<AdminArticleDetail>(`${base}/articles`, input);
  },

  update(id: string, input: ArticleInput) {
    return apiClient.put<AdminArticleDetail>(`${base}/articles/${id}`, input);
  },

  changeStatus(id: string, input: ArticleStatusInput) {
    return apiClient.post<AdminArticleDetail>(`${base}/articles/${id}/status`, input);
  },

  history(id: string) {
    return apiClient.get<AdminArticleHistoryEntry[]>(`${base}/articles/${id}/history`, { cache: 'no-store' });
  },
};
