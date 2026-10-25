import { NOTIFICATION_CATEGORY_LABELS, type InterestCategory } from '@hamdastan/config';
import type {
  CampaignCategory,
  CampaignOptions,
  CampaignStatus,
  NotificationAudience,
  NotificationAudienceKind,
  NotificationDestination,
  NotificationDestinationKind,
} from '@hamdastan/types';

import { formatCount } from '@/lib';

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'پیش‌نویس',
  scheduled: 'زمان‌بندی‌شده',
  sending: 'در حال ارسال',
  sent: 'ارسال‌شده',
  cancelled: 'لغو‌شده',
  failed: 'ناموفق',
  archived: 'بایگانی',
};

export const STATUS_BADGE: Record<CampaignStatus, 'success' | 'info' | 'warning' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  cancelled: 'secondary',
  failed: 'destructive',
  archived: 'secondary',
};

export const CATEGORY_LABELS: Record<CampaignCategory, string> = {
  events: NOTIFICATION_CATEGORY_LABELS.events,
  worlds: NOTIFICATION_CATEGORY_LABELS.worlds,
  promotions: 'تبلیغاتی',
  system: 'اطلاعیه‌ی سیستمی',
};

export const CATEGORY_HINTS: Record<CampaignCategory, string> = {
  events: 'برای کاربرانی که اعلان رویدادها را خاموش کرده‌اند ارسال نمی‌شود.',
  worlds: 'برای کاربرانی که اعلان دنیاها را خاموش کرده‌اند ارسال نمی‌شود.',
  promotions: 'برای کاربرانی که اعلان تبلیغاتی را خاموش کرده‌اند ارسال نمی‌شود و روی گوشی فقط به کسانی می‌رسد که خودشان آن را روشن کرده‌اند.',
  system: 'برای اطلاعات مهم و عملیاتی؛ کاربر نمی‌تواند آن را خاموش کند. از این دسته برای تبلیغ استفاده نکنید.',
};

export const AUDIENCE_KINDS: { value: NotificationAudienceKind; label: string }[] = [
  { value: 'all', label: 'همه‌ی کاربران' },
  { value: 'world', label: 'دنیاها' },
  { value: 'event', label: 'یک رویداد' },
  { value: 'interests', label: 'گروه‌ها (علاقه‌مندی)' },
  { value: 'users', label: 'کاربران منتخب' },
];

export const DESTINATION_KINDS: { value: NotificationDestinationKind; label: string }[] = [
  { value: 'none', label: 'بدون مقصد' },
  { value: 'home', label: 'خانه' },
  { value: 'events', label: 'فهرست رویدادها' },
  { value: 'event', label: 'یک رویداد' },
  { value: 'activities', label: 'فهرست فعالیت‌ها' },
  { value: 'activity', label: 'یک فعالیت' },
  { value: 'my_events', label: 'رویدادهای من' },
  { value: 'profile', label: 'پروفایل' },
];

/** Who a campaign goes to, in one line. `categories` names an interests audience. */
export function describeAudience(
  audience: NotificationAudience,
  options?: CampaignOptions | null,
  categories: readonly Pick<InterestCategory, 'id' | 'title'>[] = []
): string {
  switch (audience.kind) {
    case 'all':
      return 'همه‌ی کاربران';
    case 'users':
      return `${formatCount(audience.phones.length)} شماره‌ی منتخب`;
    case 'interests':
      return `علاقه‌مندان ${audience.categoryIds
        .map((id) => categories.find((category) => category.id === id)?.title ?? id)
        .join('، ')}`;
    case 'event': {
      const title = options?.events.find((event) => event.id === audience.eventId)?.title ?? 'یک رویداد';
      return `${audience.relation === 'confirmed' ? 'ثبت‌نام‌های قطعی' : 'علاقه‌مندان'} «${title}»`;
    }
    case 'world': {
      const names = audience.worldIds.map((id) => options?.worlds.find((world) => world.id === id)?.name ?? 'دنیا');
      return `شرکت‌کنندگان و علاقه‌مندان رویدادهای ${names.map((name) => `«${name}»`).join('، ')}`;
    }
  }
}

export function describeDestination(destination: NotificationDestination, options?: CampaignOptions | null): string {
  if (destination.kind === 'event') return `رویداد «${options?.events.find((e) => e.id === destination.eventId)?.title ?? '…'}»`;
  if (destination.kind === 'activity') return `فعالیت «${options?.activities.find((a) => a.id === destination.activityId)?.title ?? '…'}»`;
  return DESTINATION_KINDS.find((kind) => kind.value === destination.kind)?.label ?? '—';
}

export const HISTORY_LABELS: Record<string, string> = {
  create: 'ساخته شد',
  update: 'ویرایش شد',
  duplicated_from: 'از کمپین دیگری تکثیر شد',
  send: 'برای ارسال فوری در صف قرار گرفت',
  schedule: 'زمان‌بندی شد',
  cancel: 'لغو شد',
  archive: 'بایگانی شد',
  sent: 'ارسال شد',
  failed: 'ارسال ناموفق بود',
  push_stopped: 'ارسال‌های پوشِ باقی‌مانده متوقف شد',
  push_skipped: 'پوش ارسال نشد: زیرساخت پوش پیکربندی نشده بود',
};
