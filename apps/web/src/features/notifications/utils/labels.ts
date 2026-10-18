import { Award, CalendarDays, Globe, Info, Megaphone, Target, type LucideIcon } from 'lucide-react';

import { NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY_LABELS } from '@hamdastan/config';
import type { NotificationCategory, NotificationFilter } from '@hamdastan/types';

/** One icon per category, drawn neutral — a category is told apart by shape, never by colour. */
export const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  activity: Target,
  achievements: Award,
  events: CalendarDays,
  worlds: Globe,
  promotions: Megaphone,
  system: Info,
};

const SHORT_LABELS: Record<NotificationCategory, string> = {
  activity: 'فعالیت‌ها',
  achievements: 'دستاوردها',
  events: 'رویدادها',
  worlds: 'دنیاها',
  promotions: 'پیشنهادها',
  system: 'سیستم',
};

/** The Center's tabs: everything, the unread, then every category something in the product sends. */
export const FILTER_TABS: { id: NotificationFilter; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'unread', label: 'خوانده‌نشده' },
  ...NOTIFICATION_CATEGORIES.map((category) => ({ id: category, label: SHORT_LABELS[category] })),
];

/** What each preference row says it controls. */
export const PREFERENCE_HINTS: Record<Exclude<NotificationCategory, 'system'>, string> = {
  activity: 'XP و نتیجه‌ی مأموریت‌ها',
  achievements: 'سطح جدید و نشان‌ها',
  events: 'یادآوری، تغییر و لغو، نتیجه‌ی خرید',
  worlds: 'خبرهای دنیاهای داستانی',
  promotions: 'پیشنهادهای ویژه',
};

export const categoryLabel = (category: NotificationCategory) => NOTIFICATION_CATEGORY_LABELS[category];
