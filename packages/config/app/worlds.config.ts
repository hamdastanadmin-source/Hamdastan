/**
 * Worlds (دنیاها) as the CMS keeps them: the lifecycle, the theme presets,
 * the sections a world's menu and home are built from, and the limits both
 * apps and the API agree on. The worlds themselves are rows, not lists here.
 */

export const WORLD_STATUSES = ['draft', 'published', 'unpublished', 'archived'] as const;
export type WorldStatusId = (typeof WORLD_STATUSES)[number];

export const WORLD_STATUS_LABELS: Record<WorldStatusId, string> = {
  draft: 'پیش‌نویس',
  published: 'منتشرشده',
  unpublished: 'لغو انتشار',
  archived: 'بایگانی',
};

/**
 * A world's look, as one of a few presets the product draws from its tokens
 * (`--world-*` in tokens.css) — never a colour an admin types, so every world
 * stays readable in light and dark.
 */
export const WORLD_THEMES = ['neutral', 'emerald', 'amber', 'rose', 'sky', 'indigo'] as const;
export type WorldThemeId = (typeof WORLD_THEMES)[number];

export const WORLD_THEME_LABELS: Record<WorldThemeId, string> = {
  neutral: 'خنثی',
  emerald: 'زمردی',
  amber: 'کهربایی',
  rose: 'گلی',
  sky: 'آسمانی',
  indigo: 'نیلی',
};

/**
 * The parts of a world page. `home` is always first and always on; the rest
 * are the menu's tabs, in the order and with the labels the admin sets.
 */
export const WORLD_SECTIONS = ['home', 'news', 'knowledge', 'events', 'activities'] as const;
export type WorldSectionId = (typeof WORLD_SECTIONS)[number];

export const WORLD_SECTION_LABELS: Record<WorldSectionId, string> = {
  home: 'خانه',
  news: 'اخبار',
  knowledge: 'دانستنی‌ها',
  events: 'رویدادها',
  activities: 'فعالیت‌ها',
};

/** The sections a world home is made of — every menu section but home itself. */
export const WORLD_HOME_KINDS = ['news', 'knowledge', 'events', 'activities'] as const;
export type WorldHomeKindId = (typeof WORLD_HOME_KINDS)[number];

export const WORLD_HOME_SOURCES = ['latest', 'featured'] as const;
export type WorldHomeSourceId = (typeof WORLD_HOME_SOURCES)[number];

export const WORLD_HOME_SOURCE_LABELS: Record<WorldHomeSourceId, string> = {
  latest: 'جدیدترین موارد واجد شرایط',
  featured: 'فقط موارد ویژه‌ی انتخاب‌شده',
};

export const WORLD_HOME_WHEN_EMPTY = ['hide', 'message'] as const;
export type WorldHomeWhenEmptyId = (typeof WORLD_HOME_WHEN_EMPTY)[number];

export const WORLD_HOME_WHEN_EMPTY_LABELS: Record<WorldHomeWhenEmptyId, string> = {
  hide: 'بخش پنهان شود',
  message: 'پیام «فعلاً چیزی نیست» نمایش داده شود',
};

/** A new world's menu and home: every section, in this order. */
export const WORLD_DEFAULT_NAVIGATION: ReadonlyArray<{ section: WorldSectionId; label: string; enabled: boolean }> =
  WORLD_SECTIONS.map((section) => ({ section, label: WORLD_SECTION_LABELS[section], enabled: true }));

export const WORLD_DEFAULT_HOME_ORDER: readonly WorldHomeKindId[] = ['news', 'events', 'activities', 'knowledge'];

export const WORLD_LIMITS = {
  NAME_MAX: 80,
  SUMMARY_MAX: 300,
  TAGLINE_MAX: 120,
  DESCRIPTION_MAX: 4000,
  NAV_LABEL_MAX: 20,
  SECTION_TITLE_MAX: 60,
  /** Items a home section shows. */
  SECTION_ITEMS_MAX: 12,
  /** A section's own list of featured items. */
  FEATURED_MAX: 12,
  /** Worlds one article or activity may be filed under. */
  FILED_UNDER_MAX: 10,
} as const;

/** How many items a world's tab lists per page. */
export const WORLD_PAGE_SIZE = 20;
