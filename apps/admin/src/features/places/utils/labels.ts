import type { PlaceStatus, PlaceStatusAction } from '@hamdastan/types';

/** Everything the places section prints about a status. */

/** Neutral or semantic — never the brand colour. */
export const PLACE_STATUS_BADGE: Record<PlaceStatus, 'success' | 'outline'> = {
  draft: 'outline',
  published: 'success',
};

export const PLACE_ACTION_LABELS: Record<PlaceStatusAction, string> = {
  publish: 'انتشار',
  unpublish: 'لغو انتشار',
};

export const PLACE_ACTION_DONE: Record<PlaceStatusAction, string> = {
  publish: 'منتشر شد',
  unpublish: 'به پیش‌نویس برگشت',
};

/** «نقشه»، «لایه‌ی اول»… : how far below the map a place sits. */
export const DEPTH_LABELS = ['نقشه', 'لایه‌ی اول', 'لایه‌ی دوم'] as const;
