/**
 * Types internal to the Places module. The wire shapes are in
 * `@hamdastan/types` (`places.ts`); this is what the repository returns.
 */

import type { PlacePin, PlaceStatus } from '@hamdastan/types';
import type { PlaceInputOutput } from '@hamdastan/validation';

export type PlaceRecord = {
  id: string;
  worldId: string;
  parentId: string | null;
  depth: number;
  name: string;
  summary: string;
  imageId: string | null;
  pin: PlacePin;
  position: number;
  status: PlaceStatus;
  publishedAt: Date | null;
  updatedAt: Date;
  /** Published, under published places, in a published world: what the product may show. */
  available: boolean;
  activityCount: number;
  childCount: number;
  /** Published tasks here and in the published places inside it — what its pin says. */
  taskCount: number;
};

/** A place with its tasks, in order. */
export type PlaceDetailRecord = PlaceRecord & { activityIds: string[] };

export type PlaceFields = PlaceInputOutput;
