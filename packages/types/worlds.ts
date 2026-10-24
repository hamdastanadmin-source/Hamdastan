/**
 * Worlds — دنیاها: a world's identity and lifecycle, its menu, and its home
 * page — what the panel configures and what the product draws from it.
 */

import type {
  WorldHomeKindId,
  WorldHomeSourceId,
  WorldHomeWhenEmptyId,
  WorldSectionId,
  WorldStatusId,
  WorldThemeId,
} from '@hamdastan/config';

import type { ArticleCard, ContentStatus } from './content';
import type { ActivityCard } from './engagement';
import type { EventCard } from './events';

export type WorldStatus = WorldStatusId;
export type WorldTheme = WorldThemeId;
export type WorldSection = WorldSectionId;
export type WorldHomeKind = WorldHomeKindId;
export type WorldHomeSource = WorldHomeSourceId;
export type WorldHomeWhenEmpty = WorldHomeWhenEmptyId;

/** One item of a world's menu (its bottom bar). The array's order is the menu's. */
export type WorldNavItem = { section: WorldSection; label: string; enabled: boolean };

// ─── Product ─────────────────────────────────────────────────────────────────

/** A world in a list: the home picker, an event's filter. */
export type World = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  coverId: string | null;
};

/** `GET /worlds/:slug` — a published world, with the tabs that are on. */
export type WorldDetail = World & {
  tagline: string;
  description: string;
  theme: WorldTheme;
  navigation: WorldNavItem[];
};

/** One section of a world's home, with the items that may appear now. */
export type WorldHomeBlock =
  | { kind: 'news' | 'knowledge'; title: string; items: ArticleCard[] }
  | { kind: 'events'; title: string; items: EventCard[] }
  | { kind: 'activities'; title: string; items: ActivityCard[] };

/** `GET /worlds/:slug/home`. A section with nothing to show is absent unless it asks for its empty state. */
export type WorldHome = {
  world: WorldDetail;
  sections: WorldHomeBlock[];
  /** Only on an admin's preview: how the world stands in the panel. */
  preview?: { status: WorldStatus };
};

// ─── Admin ───────────────────────────────────────────────────────────────────

export type AdminWorld = World & {
  tagline: string;
  position: number;
  status: WorldStatus;
  publishedAt: string | null;
  /** What is filed under it, in any status. One with anything cannot be deleted. */
  eventCount: number;
  articleCount: number;
  activityCount: number;
  updatedAt: string;
};

export type AdminWorldDetail = AdminWorld & {
  description: string;
  theme: WorldTheme;
  /** Every section, on or off, in menu order. */
  navigation: WorldNavItem[];
};

/** `POST /admin/worlds`, `PUT /admin/worlds/:id`. */
export type WorldInput = {
  slug: string;
  name: string;
  summary: string;
  tagline: string;
  description: string;
  coverId: string | null;
  theme: WorldTheme;
  navigation: WorldNavItem[];
};

export type WorldStatusAction = 'publish' | 'unpublish' | 'archive' | 'restore';

/** `POST /admin/worlds/:id/status`. */
export type WorldStatusInput = { action: WorldStatusAction };

/** An item that can be featured on a world's home, as the panel lists it. */
export type WorldHomeCandidate = {
  id: string;
  title: string;
  /** The item's own status, in the content index's words. */
  status: ContentStatus;
  /** Whether it may appear on the home right now — published, current, not ended. */
  live: boolean;
};

export type AdminWorldHomeSection = {
  kind: WorldHomeKind;
  /** Empty: the default title. */
  title: string;
  source: WorldHomeSource;
  itemLimit: number;
  whenEmpty: WorldHomeWhenEmpty;
  enabled: boolean;
  /** In order. Kept even while not live; only live ones appear. */
  featured: WorldHomeCandidate[];
};

/** `GET /admin/worlds/:id/home` — every section, in home order. */
export type AdminWorldHome = { sections: AdminWorldHomeSection[] };

/** `PUT /admin/worlds/:id/home` — every kind exactly once; the array's order is the home's. */
export type WorldHomeInput = {
  sections: {
    kind: WorldHomeKind;
    title: string;
    source: WorldHomeSource;
    itemLimit: number;
    whenEmpty: WorldHomeWhenEmpty;
    enabled: boolean;
    featuredIds: string[];
  }[];
};

export const WORLD_ERROR_CODES = {
  WORLD_SLUG_TAKEN: 'WORLD_SLUG_TAKEN',
  WORLD_IN_USE: 'WORLD_IN_USE',
  WORLD_INCOMPLETE: 'WORLD_INCOMPLETE',
  WORLD_INVALID_TRANSITION: 'WORLD_INVALID_TRANSITION',
  WORLD_ARCHIVED: 'WORLD_ARCHIVED',
  /** A featured item that is not of the section's kind or not filed under the world. */
  WORLD_HOME_ITEM_INVALID: 'WORLD_HOME_ITEM_INVALID',
} as const;
