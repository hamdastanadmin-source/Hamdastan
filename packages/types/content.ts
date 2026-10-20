/**
 * Content — news items (خبر) and knowledge articles (دانستنی) filed under
 * worlds: what the product reads, what the panel edits, and the central
 * content index that lists articles, events and activities side by side.
 */

import type { ArticleKindId, ArticleStoredStatusId } from '@hamdastan/config';

export type ArticleKind = ArticleKindId;
export type ArticleStoredStatus = ArticleStoredStatusId;
/** `scheduled` is read off the clock: published, its publication date still ahead. */
export type ArticleStatus = ArticleStoredStatus | 'scheduled';

// ─── Product ─────────────────────────────────────────────────────────────────

/** One article in a list: a world's tab, its home, the content index. */
export type ArticleCard = {
  id: string;
  slug: string;
  kind: ArticleKind;
  title: string;
  summary: string;
  category: string;
  /** The thumbnail, else the cover; null when the article has neither. */
  imageId: string | null;
  publishedAt: string;
  /** Only the published ones. */
  worlds: { slug: string; name: string }[];
};

export type ArticleDetail = ArticleCard & {
  /** Plain text; a blank line starts a paragraph. */
  body: string;
  coverId: string | null;
  coverAlt: string;
  /** Only on an admin's preview: how the article stands in the panel. */
  preview?: { status: ArticleStatus };
};

/** `GET /content/articles`. */
export type ArticleListQuery = {
  world?: string;
  kind?: ArticleKind;
  page?: number;
  pageSize?: number;
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminArticleSummary = {
  id: string;
  slug: string;
  kind: ArticleKind;
  title: string;
  category: string;
  status: ArticleStatus;
  publishAt: string | null;
  worlds: { id: string; name: string }[];
  updatedAt: string;
};

export type AdminArticleDetail = AdminArticleSummary & {
  summary: string;
  body: string;
  coverId: string | null;
  coverAlt: string;
  thumbnailId: string | null;
  worldIds: string[];
  createdAt: string;
};

/** `POST /admin/content/articles`, `PUT /admin/content/articles/:id`. */
export type ArticleInput = {
  kind: ArticleKind;
  /** Empty: the API makes one. */
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  coverId: string | null;
  coverAlt: string;
  thumbnailId: string | null;
  worldIds: string[];
};

export type ArticleStatusAction = 'publish' | 'unpublish' | 'archive';

/** `POST /admin/content/articles/:id/status`. `publishAt` ahead schedules it; empty or past is now. */
export type ArticleStatusInput = { action: ArticleStatusAction; publishAt?: string | null };

export type AdminArticleListQuery = {
  q?: string;
  kind?: ArticleKind;
  status?: ArticleStatus;
  world?: string;
  page?: number;
  pageSize?: number;
};

export type AdminArticleHistoryEntry = {
  id: string;
  action: string;
  admin: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

// ─── The content index ───────────────────────────────────────────────────────

export const CONTENT_TYPES = ['news', 'knowledge', 'event', 'activity'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Every kind's own lifecycle, folded into the words the index filters by.
 * `ended` is an event past its end, a closed or past-its-end activity, or a
 * cancelled event; `paused` is an activity's alone.
 */
export const CONTENT_STATUSES = ['draft', 'scheduled', 'published', 'paused', 'unpublished', 'ended', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** One row of `GET /admin/content`. Editing happens in the kind's own editor. */
export type ContentIndexItem = {
  type: ContentType;
  id: string;
  title: string;
  status: ContentStatus;
  worlds: { id: string; name: string }[];
  updatedAt: string;
};

export type ContentIndexQuery = {
  q?: string;
  type?: ContentType;
  status?: ContentStatus;
  world?: string;
  page?: number;
  pageSize?: number;
};

export const CONTENT_ERROR_CODES = {
  ARTICLE_SLUG_TAKEN: 'ARTICLE_SLUG_TAKEN',
  ARTICLE_INCOMPLETE: 'ARTICLE_INCOMPLETE',
  ARTICLE_INVALID_TRANSITION: 'ARTICLE_INVALID_TRANSITION',
  ARTICLE_ARCHIVED: 'ARTICLE_ARCHIVED',
} as const;
