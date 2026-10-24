import type { ActivityCard, ArticleCard, EventCard, Paginated, WorldDetail, WorldHomeBlock } from '@hamdastan/types';

/**
 * A world's pages. Its menu has two — home and «فعالیت‌ها» — and each home
 * section of news, knowledge or events has a «همه» page of its own, one
 * step down. `null` is a list that could not be read.
 */

/** The home sections that open a «همه» page. */
export const WORLD_LIST_KINDS = ['events', 'news', 'knowledge'] as const;
export type WorldListKind = (typeof WORLD_LIST_KINDS)[number];

export type WorldHomePage = { world: WorldDetail; sections: WorldHomeBlock[] | null };
export type WorldActivitiesPage = { world: WorldDetail; cards: ActivityCard[] | null };
export type WorldListPage =
  | { world: WorldDetail; kind: 'news' | 'knowledge'; page: Paginated<ArticleCard> | null }
  | { world: WorldDetail; kind: 'events'; page: Paginated<EventCard> | null };

export const worldHref = (slug: string) => `/worlds/${slug}`;

export const worldActivitiesHref = (slug: string) => `/worlds/${slug}/activities`;

export const worldListHref = (slug: string, kind: WorldListKind, page = 1) => `/worlds/${slug}/${kind}${page > 1 ? `?page=${page}` : ''}`;

/** Whether the world's menu has «فعالیت‌ها» on. */
export const hasActivities = (world: WorldDetail) => world.navigation.some((item) => item.section === 'activities');
