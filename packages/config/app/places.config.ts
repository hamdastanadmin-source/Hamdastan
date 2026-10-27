/**
 * Places (مکان‌ها) as the CMS keeps them: a world's map, the places pinned
 * on it and the places inside those, each an image with the tasks done
 * there. The places themselves are rows, not lists here.
 */

/**
 * A world has one map (depth 0); a place sits at most two layers below it —
 * map → house → room. The schema enforces it too (`v2_places_layer`).
 */
export const PLACE_MAX_DEPTH = 2;

export const PLACE_STATUSES = ['draft', 'published'] as const;
export type PlaceStatusId = (typeof PLACE_STATUSES)[number];

export const PLACE_STATUS_LABELS: Record<PlaceStatusId, string> = {
  draft: 'پیش‌نویس',
  published: 'منتشرشده',
};

/** Where a new place's pin starts on its parent's image: the middle, in percent. */
export const PLACE_PIN_DEFAULT = { x: 50, y: 50 } as const;

export const PLACE_LIMITS = {
  NAME_MAX: 80,
  SUMMARY_MAX: 300,
  /** Tasks at one place. */
  ACTIVITIES_MAX: 12,
  /** Places pinned on one image. */
  CHILDREN_MAX: 24,
} as const;
