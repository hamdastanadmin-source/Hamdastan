import { WORLD_SECTIONS, type WorldSectionId, type WorldThemeId } from '@hamdastan/config';
import type { ActivityCard, ArticleCard, EventCard, Paginated, WorldDetail, WorldHomeBlock } from '@hamdastan/types';

export type WorldTab = WorldSectionId;

/** What one tab of a world's page shows. `null` is a list that could not be read. */
export type WorldTabContent =
  | { tab: 'home'; sections: WorldHomeBlock[] | null }
  | { tab: 'news' | 'knowledge'; page: Paginated<ArticleCard> | null }
  | { tab: 'events'; page: Paginated<EventCard> | null }
  | { tab: 'activities'; cards: ActivityCard[] | null };

export type WorldPage = { world: WorldDetail; content: WorldTabContent };

/** `?tab=` as asked, if the world's menu has it on; anything else is home. */
export function tabOf(world: WorldDetail, asked: string | undefined): WorldTab {
  const tab = WORLD_SECTIONS.find((section) => section === asked);
  return tab && world.navigation.some((item) => item.section === tab) ? tab : 'home';
}

/** A tab's address. Home is the world's own address. */
export const tabHref = (slug: string, tab: WorldTab, page = 1) =>
  `/worlds/${slug}${tab === 'home' ? '' : `?tab=${tab}`}${page > 1 ? `${tab === 'home' ? '?' : '&'}page=${page}` : ''}`;

/** Each theme's tint, as a whole class so the build sees it. The colours are tokens (`--world-*`). */
export const THEME_BAND: Record<WorldThemeId, string> = {
  neutral: 'bg-world-neutral',
  emerald: 'bg-world-emerald',
  amber: 'bg-world-amber',
  rose: 'bg-world-rose',
  sky: 'bg-world-sky',
  indigo: 'bg-world-indigo',
};
