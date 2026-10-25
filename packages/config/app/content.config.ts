/**
 * Content (محتوا): news items and knowledge articles filed under worlds.
 * The vocabularies and limits the admin editor, the product and the API
 * agree on.
 */

export const ARTICLE_KINDS = ['news', 'knowledge'] as const;
export type ArticleKindId = (typeof ARTICLE_KINDS)[number];

export const ARTICLE_KIND_LABELS: Record<ArticleKindId, string> = {
  news: 'خبر',
  knowledge: 'دانستنی',
};

export const ARTICLE_STATUSES = ['draft', 'published', 'unpublished', 'archived'] as const;
export type ArticleStoredStatusId = (typeof ARTICLE_STATUSES)[number];

/** What a person may say about an article: they liked it, or they did not. */
export const ARTICLE_REACTIONS = ['like', 'dislike'] as const;
export type ArticleReactionId = (typeof ARTICLE_REACTIONS)[number];

export const ARTICLE_LIMITS = {
  TITLE_MAX: 120,
  SLUG_MAX: 80,
  SUMMARY_MAX: 300,
  BODY_MAX: 20_000,
  CATEGORY_MAX: 40,
  ALT_MAX: 150,
  WORLDS_MAX: 10,
} as const;

export const ARTICLES_PAGE_SIZE = 20;

/** Words an article slug may not be: they are paths beside `/articles/:slug`. */
export const ARTICLE_RESERVED_SLUGS = ['new', 'preview'] as const;
