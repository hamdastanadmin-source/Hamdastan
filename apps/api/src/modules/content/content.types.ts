/**
 * Types internal to the Content module. The wire shapes are in
 * `@hamdastan/types` (`content.ts`).
 */

import type { ArticleKind, ArticleReactionCounts, ArticleStoredStatus, ContentIndexItem } from '@hamdastan/types';
import type { ArticleInputOutput } from '@hamdastan/validation';

/** An article's editable fields, as parsed. An empty slug has been replaced by then. */
export type ArticleFields = ArticleInputOutput;

export type ArticleRecord = {
  id: string;
  kind: ArticleKind;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  coverId: string | null;
  coverAlt: string;
  thumbnailId: string | null;
  status: ArticleStoredStatus;
  publishAt: Date | null;
  worlds: { id: string; slug: string; name: string; published: boolean }[];
  reactions: ArticleReactionCounts;
  createdAt: Date;
  updatedAt: Date;
};

export type ArticleHistoryRecord = {
  id: string;
  action: string;
  adminName: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

export type ContentIndexRecord = Omit<ContentIndexItem, 'updatedAt'> & { updatedAt: Date };

/** Which of a world's articles to read: the given ids (in any order), or a search. */
export type WorldArticleQuery = { ids?: string[]; q?: string; liveOnly: boolean; limit: number };
