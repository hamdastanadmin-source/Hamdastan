/**
 * Notifications (اعلان‌ها): the fixed vocabularies and limits both apps and
 * the API agree on.
 *
 * A category is listed only when something in the product produces it —
 * the Notification Center's tabs and the preferences screen are built from
 * this list, so a category with no source would be a switch that does
 * nothing. Social, ranking and wallet notifications arrive with the modules
 * that would send them.
 */

export const NOTIFICATION_CATEGORIES = ['activity', 'achievements', 'events', 'worlds', 'promotions', 'system'] as const;
export type NotificationCategoryId = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategoryId, string> = {
  activity: 'فعالیت‌ها و XP',
  achievements: 'نشان‌ها و سطح',
  events: 'رویدادها',
  worlds: 'دنیاها',
  promotions: 'پیشنهادها و اطلاعیه‌های تبلیغاتی',
  system: 'سیستم',
};

/**
 * What a person may switch off. `system` is not among them: it carries what
 * an account needs to know, and is sent to everyone it concerns.
 */
export const OPTIONAL_NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORIES.filter(
  (category): category is Exclude<NotificationCategoryId, 'system'> => category !== 'system'
);

/** The categories an admin campaign may be filed under. The rest are the system's own. */
export const CAMPAIGN_CATEGORIES = ['events', 'worlds', 'promotions', 'system'] as const;
export type CampaignCategoryId = (typeof CAMPAIGN_CATEGORIES)[number];

/**
 * A person who never touched a switch: everything arrives in the app, and
 * on the phone too, except promotions — those reach a phone only on request.
 */
export const NOTIFICATION_DEFAULTS = {
  inApp: true,
  push: (category: NotificationCategoryId) => category !== 'promotions',
} as const;

export const NOTIFICATION_LIMITS = {
  TITLE_MAX: 80,
  BODY_MAX: 240,
  /** A page of the Notification Center. */
  PAGE_SIZE: 20,
  /** Campaigns in the panel's list. */
  ADMIN_PAGE_SIZE: 20,
  /** Explicitly chosen numbers in one campaign. */
  AUDIENCE_PHONES_MAX: 5000,
  WORLDS_MAX: 10,
} as const;
