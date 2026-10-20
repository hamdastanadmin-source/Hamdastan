import type { ArticleStatus, ArticleStatusAction, ContentStatus, ContentType } from '@hamdastan/types';

/** Everything the content section prints about a type or a status. */

type BadgeVariant = 'success' | 'info' | 'warning' | 'secondary' | 'outline' | 'destructive';

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  news: 'خبر',
  knowledge: 'دانستنی',
  event: 'رویداد',
  activity: 'فعالیت',
};

export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  paused: 'متوقف',
  unpublished: 'لغو انتشار',
  ended: 'پایان‌یافته',
  archived: 'بایگانی',
};

/** Neutral or semantic — never the brand colour. */
export const CONTENT_STATUS_BADGE: Record<ContentStatus, BadgeVariant> = {
  draft: 'outline',
  scheduled: 'info',
  published: 'success',
  paused: 'warning',
  unpublished: 'warning',
  ended: 'secondary',
  archived: 'secondary',
};

/** Where each kind is edited — every kind keeps its own editor. */
export const editHref = (type: ContentType, id: string) =>
  type === 'event' ? `/events/${id}/edit` : type === 'activity' ? `/engagement/${id}/edit` : `/content/articles/${id}`;

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  unpublished: 'لغو انتشار',
  archived: 'بایگانی',
};

export const ARTICLE_ACTION_LABELS: Record<ArticleStatusAction, string> = {
  publish: 'انتشار',
  unpublish: 'لغو انتشار',
  archive: 'بایگانی',
};

/** Which status actions each status allows — the API holds the same table. */
export const ARTICLE_ACTIONS_FOR: Record<ArticleStatus, ArticleStatusAction[]> = {
  draft: ['publish', 'archive'],
  // Publishing again moves the scheduled date.
  scheduled: ['publish', 'unpublish', 'archive'],
  published: ['unpublish', 'archive'],
  unpublished: ['publish', 'archive'],
  archived: [],
};

export const ARTICLE_CONFIRM_COPY: Partial<Record<ArticleStatusAction, string>> = {
  unpublish: 'محتوا تا انتشار دوباره از اپلیکیشن و خانه‌ی دنیاها برداشته می‌شود.',
  archive: 'محتوا از اپلیکیشن برداشته و غیرقابل ویرایش می‌شود. سابقه‌ی آن حفظ می‌شود.',
};

/** The history's actions, as an admin reads them. */
export const ARTICLE_HISTORY_LABELS: Record<string, string> = {
  create: 'ساخته شد',
  update: 'ویرایش شد',
  publish: 'منتشر شد',
  schedule: 'انتشار زمان‌بندی شد',
  unpublish: 'انتشار لغو شد',
  archive: 'بایگانی شد',
};
