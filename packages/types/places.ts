/**
 * Places — مکان‌ها: a world's map, the places pinned on it and the places
 * inside those (two layers at most), each an image with the tasks done
 * there — what the panel builds and what the product shows.
 */

import type { PlaceStatusId } from '@hamdastan/config';

import type { ActivityCard } from './engagement';

export type PlaceStatus = PlaceStatusId;

/** Where a place is pinned on its parent's image, in percent from the image's left and top edges. */
export type PlacePin = { x: number; y: number };

// ─── Admin ───────────────────────────────────────────────────────────────────

/** A place in the panel's tree. */
export type AdminPlaceSummary = {
  id: string;
  worldId: string;
  parentId: string | null;
  depth: number;
  name: string;
  status: PlaceStatus;
  imageId: string | null;
  pin: PlacePin;
  activityCount: number;
  childCount: number;
  updatedAt: string;
};

export type AdminPlaceDetail = AdminPlaceSummary & {
  world: { id: string; slug: string; name: string };
  summary: string;
  /** The tasks, in order. */
  activityIds: string[];
  /** The places pinned on this one's image, in order. */
  children: AdminPlaceSummary[];
  publishedAt: string | null;
};

/** `POST /admin/places`: a new draft — the world's map when `parentId` is null. */
export type PlaceCreateInput = { worldId: string; parentId: string | null; name: string };

/** `PUT /admin/places/:id`: the place, with where its children are pinned on its image. */
export type PlaceInput = {
  name: string;
  summary: string;
  imageId: string | null;
  activityIds: string[];
  pins: ({ id: string } & PlacePin)[];
};

export type PlaceStatusAction = 'publish' | 'unpublish';

// ─── Product ─────────────────────────────────────────────────────────────────

/** A step of the way down: the map, a place, a place inside it. */
export type PlaceCrumb = { id: string; name: string };

/** A place pinned on an image, with how many tasks are in it and the places inside it. */
export type PlaceMapPin = PlaceCrumb & PlacePin & { taskCount: number };

/** `GET /worlds/:slug/places/map`, `GET /worlds/:slug/places/:id`. */
export type PlaceView = {
  id: string;
  world: { slug: string; name: string };
  name: string;
  summary: string;
  imageId: string | null;
  /** The way down from the map to here, this place last. */
  trail: PlaceCrumb[];
  pins: PlaceMapPin[];
  /** The tasks open to this person here, in order. */
  tasks: ActivityCard[];
};

export const PLACE_ERROR_CODES = {
  /** The parent would put it more than two layers below the map. */
  PLACE_TOO_DEEP: 'PLACE_TOO_DEEP',
  /** The world already has its map. */
  PLACE_MAP_EXISTS: 'PLACE_MAP_EXISTS',
  /** A place with places inside it, or a published one, is not deleted. */
  PLACE_IN_USE: 'PLACE_IN_USE',
  PLACE_INCOMPLETE: 'PLACE_INCOMPLETE',
  PLACE_INVALID_TRANSITION: 'PLACE_INVALID_TRANSITION',
} as const;
