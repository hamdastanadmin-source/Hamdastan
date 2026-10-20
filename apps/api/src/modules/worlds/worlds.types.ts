/**
 * Types internal to the Worlds module. The wire shapes are in
 * `@hamdastan/types` (`worlds.ts`).
 */

import type { WorldHomeKind, WorldHomeSource, WorldHomeWhenEmpty, WorldNavItem, WorldStatus, WorldTheme } from '@hamdastan/types';
import type { WorldInputOutput } from '@hamdastan/validation';

export type WorldFields = WorldInputOutput;

export type WorldRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  tagline: string;
  description: string;
  coverId: string | null;
  logoId: string | null;
  theme: WorldTheme;
  navigation: WorldNavItem[];
  position: number;
  status: WorldStatus;
  publishedAt: Date | null;
  eventCount: number;
  articleCount: number;
  activityCount: number;
  updatedAt: Date;
};

/** One section of a world's home, as stored: its settings and its featured ids, in order. */
export type HomeSectionRecord = {
  kind: WorldHomeKind;
  title: string;
  source: WorldHomeSource;
  itemLimit: number;
  whenEmpty: WorldHomeWhenEmpty;
  enabled: boolean;
  featuredIds: string[];
};
