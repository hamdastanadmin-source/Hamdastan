import type { WorldStatus, WorldStatusAction } from '@hamdastan/types';

/** Everything the worlds section prints about a status, and the tabs of a world's page. */

export const WORLD_TABS = ['identity', 'menu', 'home', 'content', 'preview'] as const;
export type WorldTab = (typeof WORLD_TABS)[number];

/** Neutral or semantic — never the brand colour. */
export const WORLD_STATUS_BADGE: Record<WorldStatus, 'success' | 'warning' | 'secondary' | 'outline'> = {
  draft: 'outline',
  published: 'success',
  unpublished: 'warning',
  archived: 'secondary',
};

export const WORLD_ACTION_LABELS: Record<WorldStatusAction, string> = {
  publish: 'انتشار',
  unpublish: 'لغو انتشار',
  archive: 'بایگانی',
  restore: 'بازگردانی',
};

/** Which status actions each status allows — the API holds the same table. */
export const WORLD_ACTIONS_FOR: Record<WorldStatus, WorldStatusAction[]> = {
  draft: ['publish', 'archive'],
  published: ['unpublish', 'archive'],
  unpublished: ['publish', 'archive'],
  archived: ['restore'],
};

export const WORLD_ACTION_DONE: Record<WorldStatusAction, string> = {
  publish: 'منتشر شد',
  unpublish: 'انتشارش لغو شد',
  archive: 'بایگانی شد',
  restore: 'بازگردانی شد؛ برای نمایش دوباره منتشرش کنید',
};

/** The actions that take a world away from people, and so ask first. */
export const WORLD_CONFIRM_COPY: Partial<Record<WorldStatusAction, string>> = {
  unpublish: 'دنیا تا انتشار دوباره از اپلیکیشن برداشته می‌شود. محتوای متصل به آن دست نمی‌خورد.',
  archive: 'دنیا از اپلیکیشن برداشته و تا بازگردانی غیرقابل ویرایش می‌شود. همه‌ی محتوا و سوابق متصل به آن حفظ می‌شوند.',
};
