import type { BuiltinMotionEffectId, MediaCategoryId, MediaFormatId } from '@hamdastan/config';

/**
 * The media & motion library's wire contract. A file is stored once by
 * `apps/api` and referred to everywhere else by its id; an activity's
 * definition never holds a URL or a file.
 */

export type MediaKind = 'image' | 'motion';
export type MediaFormat = MediaFormatId;
export type MediaCategory = MediaCategoryId;

export type MediaAsset = {
  id: string;
  kind: MediaKind;
  format: MediaFormat;
  category: MediaCategory;
  name: string;
  sizeBytes: number;
  /** Goes up by one each time the file is replaced. */
  version: number;
  /** How many places use it: activities (any version), events, event categories, worlds. One in use cannot be deleted. */
  usage: number;
  createdAt: string;
  updatedAt: string;
};

/** `POST /admin/media`. The file travels base64-encoded inside the JSON body. */
export type MediaUploadInput = { name: string; category: MediaCategory; data: string };

/** `PATCH /admin/media/:id`. */
export type MediaUpdateInput = { name?: string; category?: MediaCategory };

/** `PUT /admin/media/:id/file` — a new file of the same kind; the id stays. */
export type MediaReplaceInput = { data: string };

export type BuiltinMotionEffect = BuiltinMotionEffectId;

type MotionCommon = {
  /** How long it stays on screen. */
  durationMs: number;
  /** A short line under it; empty for none. */
  caption: string;
  /** A video's own sound. Off unless the admin turns it on. */
  sound: boolean;
};

/**
 * A motion, wherever one can be set: a ready mascot from the library, a
 * motion uploaded for this place, one of the product's own simple effects,
 * one picked at random from a set, or none. Nothing about a motion is in
 * the product's code but the built-in effects themselves.
 */
export type MotionSetting =
  | ({ mode: 'off' } & MotionCommon)
  | ({ mode: 'mascot' | 'custom'; assetId: string } & MotionCommon)
  | ({ mode: 'builtin'; effect: BuiltinMotionEffect } & MotionCommon)
  | ({ mode: 'random'; assetIds: string[] } & MotionCommon);

export type MotionMode = MotionSetting['mode'];

/** The media an activity refers to, as the player needs to draw it. */
export type PlayerMedia = { id: string; kind: MediaKind; format: MediaFormat; version: number };

export const MEDIA_ERROR_CODES = {
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_UNSUPPORTED: 'MEDIA_UNSUPPORTED',
  MEDIA_KIND_CHANGED: 'MEDIA_KIND_CHANGED',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
} as const;
