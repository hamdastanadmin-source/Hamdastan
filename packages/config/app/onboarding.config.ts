/**
 * Onboarding: how many stages there are, the interests stage 1 offers, and
 * the rule it enforces.
 *
 * Here rather than in `apps/web` because both sides depend on it and must
 * not disagree: the browser renders the catalog and the API checks every id
 * against it, and both apply the same three-category rule.
 *
 * The ids are the contract: they are what `v2_user_interests` stores, so they
 * are stable English slugs and never the Persian label. A label can be
 * reworded freely; an id, once saved, cannot be renamed without a migration.
 * Every interest id is unique across the whole catalog, not just within its
 * category, so an interest id alone is enough to recover its category.
 */

/** The number of onboarding stages, for the progress indicator. */
export const ONBOARDING_STAGE_COUNT = 3;

/**
 * Stage 1 asks for breadth, not volume: interests from at least this many
 * different categories, and no ceiling on how many in total.
 */
export const MIN_INTEREST_CATEGORIES = 3;

export type Interest = { id: string; label: string };

export type InterestCategory = {
  id: string;
  title: string;
  interests: readonly Interest[];
};

export const INTEREST_CATEGORIES: readonly InterestCategory[] = [
  {
    id: 'music',
    title: 'موسیقی و اجرا',
    interests: [
      { id: 'concert', label: 'کنسرت' },
      { id: 'theater', label: 'تئاتر' },
      { id: 'cinema', label: 'سینما' },
      { id: 'shows', label: 'ژانرهای شو' },
      { id: 'live-music', label: 'موسیقی زنده' },
      { id: 'rock', label: 'راک' },
      { id: 'pop', label: 'پاپ' },
      { id: 'rap', label: 'رپ' },
      { id: 'electronic', label: 'الکترونیک' },
      { id: 'traditional-music', label: 'سنتی' },
    ],
  },
  {
    id: 'art',
    title: 'هنر و خلاقیت',
    interests: [
      { id: 'gallery', label: 'گالری‌گردی' },
      { id: 'painting', label: 'نقاشی' },
      { id: 'photography', label: 'عکاسی' },
      { id: 'sculpture', label: 'مجسمه' },
      { id: 'architecture', label: 'معماری' },
      { id: 'calligraphy', label: 'خوشنویسی' },
      { id: 'pottery', label: 'سفالگری' },
      { id: 'floristry', label: 'گل‌آرایی' },
      { id: 'handicraft', label: 'دست‌سازه' },
    ],
  },
  {
    id: 'learning',
    title: 'آموزش و مهارت',
    interests: [
      { id: 'workshop', label: 'ورکشاپ' },
      { id: 'course', label: 'دوره آموزشی' },
      { id: 'seminar', label: 'سمینار' },
      { id: 'bootcamp', label: 'بوت‌کمپ' },
      { id: 'mentorship', label: 'منتورشیپ' },
      { id: 'reading', label: 'مطالعه و کتاب' },
      { id: 'history-heritage', label: 'تاریخ و میراث' },
    ],
  },
  {
    id: 'lifestyle',
    title: 'تفریح و سبک زندگی',
    interests: [
      { id: 'running', label: 'دویدن' },
      { id: 'football', label: 'فوتبال' },
      { id: 'yoga', label: 'یوگا' },
      { id: 'bodybuilding', label: 'بدنسازی' },
      { id: 'cafe', label: 'کافه' },
      { id: 'persian-food', label: 'غذای ایرانی' },
      { id: 'hiking', label: 'کوهنوردی' },
      { id: 'picnic', label: 'پیک‌نیک' },
      { id: 'solo-travel', label: 'سفر تنهایی' },
      { id: 'board-games', label: 'بوردگیم' },
      { id: 'video-games', label: 'بازی‌های ویدیویی' },
    ],
  },
  {
    id: 'social',
    title: 'اجتماعی و کسب‌وکار',
    interests: [
      { id: 'startup', label: 'استارتاپ' },
      { id: 'technology', label: 'فناوری' },
      { id: 'networking', label: 'شبکه‌سازی' },
      { id: 'meetup', label: 'دورهمی' },
      { id: 'charity', label: 'خیریه' },
      { id: 'podcast-live', label: 'پادکست / رویداد زنده' },
    ],
  },
  {
    id: 'online',
    title: 'آنلاین',
    interests: [
      { id: 'webinar', label: 'وبینار' },
      { id: 'online-class', label: 'کلاس آنلاین' },
      { id: 'streaming', label: 'استریمینگ' },
      { id: 'virtual-event', label: 'رویداد مجازی' },
    ],
  },
];

/** Every interest id, mapped to the id of the category it belongs to. */
export const INTEREST_CATEGORY_BY_ID: ReadonlyMap<string, string> = new Map(
  INTEREST_CATEGORIES.flatMap((category) =>
    category.interests.map(({ id }) => [id, category.id] as const)
  )
);
