import { INTEREST_CATEGORIES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type {
  ActivityAudience,
  ActivityAuditAction,
  ActivityStatus,
  ActivityStatusAction,
  ParticipationStatus,
  ReviewStatus,
} from '@hamdastan/types';

/** Everything the studio prints about a status, an audience or an event. */

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  published: 'منتشرشده',
  paused: 'متوقف',
  closed: 'بسته‌شده',
  archived: 'بایگانی',
};

/** Neutral or semantic — never the brand colour. */
export const STATUS_BADGE: Record<ActivityStatus, 'success' | 'info' | 'warning' | 'secondary' | 'outline'> = {
  draft: 'outline',
  scheduled: 'info',
  published: 'success',
  paused: 'warning',
  closed: 'secondary',
  archived: 'secondary',
};

export const ACTION_LABELS: Record<ActivityStatusAction, string> = {
  publish: 'انتشار',
  pause: 'توقف',
  resume: 'ادامه‌ی انتشار',
  close: 'بستن',
  archive: 'بایگانی',
};

/** Which status actions each status allows — the API holds the same table. */
export const ACTIONS_FOR: Record<ActivityStatus, ActivityStatusAction[]> = {
  draft: ['publish', 'archive'],
  scheduled: ['pause', 'close', 'archive'],
  published: ['pause', 'close', 'archive'],
  paused: ['resume', 'close', 'archive'],
  closed: ['archive'],
  archived: [],
};

/** The actions that take an activity away from people, and so ask first. */
export const CONFIRM_COPY: Partial<Record<ActivityStatusAction, string>> = {
  pause: 'تا وقتی دوباره منتشرش نکنی، کسی نمی‌تونه پاسخ بده.',
  close: 'دیگه پاسخی ثبت نمی‌شه و این کار برگشت‌پذیر نیست؛ نتایج می‌مونن.',
  archive: 'از فهرست کاربران حذف می‌شه و دیگه ویرایش نمی‌شه؛ نتایج و XPهای داده‌شده می‌مونن.',
};

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: 'در انتظار بررسی',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

export const PARTICIPATION_LABELS: Record<ParticipationStatus, string> = {
  not_started: 'شروع نشده',
  in_progress: 'در حال انجام',
  pending_review: 'در انتظار تأیید',
  completed: 'انجام‌شده',
  rejected: 'ردشده',
};

export const AUDIT_LABELS: Record<ActivityAuditAction, string> = {
  created: 'ساخته شد',
  updated: 'ویرایش شد',
  version_created: 'نسخه‌ی جدید ساخته شد',
  published: 'منتشر شد',
  paused: 'متوقف شد',
  resumed: 'دوباره منتشر شد',
  closed: 'بسته شد',
  archived: 'بایگانی شد',
  duplicated: 'از یک فعالیت دیگه کپی شد',
  submission_approved: 'یک پاسخ تأیید شد',
  submission_rejected: 'یک پاسخ رد شد',
  xp_revoked: 'یک XP باطل شد',
};

const CATEGORY_TITLES = new Map(INTEREST_CATEGORIES.map((category) => [category.id, category.title]));

export function describeAudience(audience: ActivityAudience): string {
  switch (audience.kind) {
    case 'all':
      return 'همه‌ی کاربران';
    case 'users':
      return `${toPersianDigits(audience.phones.length)} کاربر منتخب`;
    case 'interests':
      return `علاقه‌مندان ${audience.categoryIds.map((id) => CATEGORY_TITLES.get(id) ?? id).join('، ')}`;
  }
}
