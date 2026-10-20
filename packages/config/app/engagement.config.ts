/**
 * Engagement Studio — the activities the admin panel designs and the product
 * plays: surveys, missions, assessments and multi-day journeys.
 *
 * The limits are here because both sides hold an activity to them: the
 * builder in `apps/admin` stops at them, and `apps/api` refuses anything
 * past them. The labels are here because both apps print them.
 */

export const ACTIVITY_TYPES = ['survey', 'mission', 'assessment', 'journey', 'competition'] as const;
export type ActivityTypeId = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityTypeId, string> = {
  survey: 'نظرسنجی',
  mission: 'مأموریت',
  assessment: 'آزمون',
  journey: 'چالش چندروزه',
  competition: 'مسابقه',
};

/** A knowledge quiz scored on the server: an assessment in knowledge mode, or a competition. */
export const isQuizType = (type: ActivityTypeId) => type === 'assessment' || type === 'competition';

/** How many people a competition's leaderboard lists. The person's own place is always added. */
export const LEADERBOARD_SIZE = 20;

/** An answer's explanation, shown once the answers may be revealed. */
export const EXPLANATION_MAX = 500;

export const QUESTION_KINDS = ['single', 'multiple', 'text', 'rating', 'scale', 'matching'] as const;
export type QuestionKindId = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKindId, string> = {
  single: 'تک‌گزینه‌ای',
  multiple: 'چندگزینه‌ای',
  text: 'متنی',
  rating: 'امتیازی',
  scale: 'طیفی',
  matching: 'تطبیقی',
};

/** Kinds no assessment dimension can measure: a personality item is never one of these. */
export const UNDIMENSIONED_KINDS: readonly QuestionKindId[] = ['text', 'matching'];

export const ENGAGEMENT_LIMITS = {
  TITLE_MAX: 120,
  SUMMARY_MAX: 200,
  DESCRIPTION_MAX: 2000,
  STEPS_MAX: 10,
  QUESTIONS_MAX: 50,
  OPTIONS_MIN: 2,
  OPTIONS_MAX: 12,
  OPTION_LABEL_MAX: 200,
  /** A text answer, and a reviewer's note. */
  TEXT_ANSWER_MAX: 2000,
  DIMENSIONS_MAX: 10,
  XP_MAX: 10_000,
  /** How many times one person may submit, and be rewarded for, one activity. */
  REPEAT_MAX: 100,
  ESTIMATED_MINUTES_MAX: 240,
  /** Phone numbers in a "selected users" audience. */
  AUDIENCE_PHONES_MAX: 5000,
  /** Rating questions run 1..max. */
  RATING_MAX_CHOICES: [5, 10] as const,
  SCALE_MIN_BOUND: 0,
  SCALE_MAX_BOUND: 10,
  /** A matching question's pairs; each side is a short tile in a two-column grid. */
  MATCHING_PAIRS_MIN: 4,
  MATCHING_PAIRS_MAX: 8,
  MATCHING_LABEL_MAX: 60,
  REASON_MAX: 300,
} as const;

/**
 * A journey is a long activity: one step per day. Its caps are wider than a
 * mission's, and only there to keep one definition a sane size.
 */
export const JOURNEY_LIMITS = {
  DAYS_MAX: 90,
  QUESTIONS_MAX: 1000,
  /** Questions per day the builder plans for; a target, not a rule. */
  QUESTIONS_PER_DAY_MAX: 100,
  /** XP per answer and per finished day. */
  STEP_XP_MAX: 1000,
  COVER_HEADLINE_MAX: 120,
  COVER_TEXT_MAX: 300,
  COVER_BUTTON_MAX: 30,
  DAY_END_TITLE_MAX: 120,
  DAY_END_MESSAGE_MAX: 400,
  SHARE_MESSAGE_MAX: 300,
  TRAITS_MAX: 12,
  CHARACTERS_MAX: 24,
  CHARACTER_NAME_MAX: 60,
  CHARACTER_DESCRIPTION_MAX: 600,
  BRAND_NAME_MAX: 40,
  /** Points one option gives one trait, either way. */
  TRAIT_POINTS_MAX: 10,
} as const;

/** What a new journey starts as: a week, ten questions a day. */
export const JOURNEY_DEFAULTS = {
  DAYS: 7,
  QUESTIONS_PER_DAY: 10,
  TIMEZONE: 'Asia/Tehran',
  /**
   * Where the colour picker starts when an admin gives a day's cover its own
   * background. Content the admin then changes, not a design token.
   */
  COVER_BACKGROUND: '#f4f1ea',
} as const;

export const COVER_ENTRY_EFFECTS = ['none', 'fade', 'slide_up', 'zoom'] as const;

export const COVER_ENTRY_EFFECT_LABELS: Record<(typeof COVER_ENTRY_EFFECTS)[number], string> = {
  none: 'بدون افکت',
  fade: 'محو شدن',
  slide_up: 'بالا آمدن',
  zoom: 'بزرگ شدن',
};

/** The day-end page a new journey starts with; the admin rewrites it. */
export const JOURNEY_DAY_END_DEFAULTS = {
  TITLE: 'عالی بود {name}!',
  MESSAGE: 'روز {day} رو پشت سر گذاشتی؛ یک قدم دیگه به کشف شخصیت خودت نزدیک شدی!',
  INVITE_TEXT: 'دوستات هم می‌تونن وارد این ماجراجویی بشن. دعوتشون کن ببینید آخرش چه شخصیت‌هایی می‌شید!',
  INVITE_BUTTON: 'دعوت از دوستان',
  SHARE_MESSAGE: 'من دارم این چالش رو توی هم‌داستان انجام می‌دم؛ تو هم بیا!',
} as const;

/** The shareable card: an Instagram story. */
export const RESULT_CARD = { WIDTH: 1080, HEIGHT: 1920, BRAND: 'هم‌داستان' } as const;

/** The zones the builder offers. Any IANA zone is accepted by the API. */
export const JOURNEY_TIMEZONES = ['Asia/Tehran', 'UTC', 'Asia/Dubai', 'Europe/Istanbul', 'Europe/London'] as const;

/**
 * The media & motion library: journey covers, question images, mascots and
 * motions. Every file — image or motion — is at most 250 KB, and its type is
 * read from its bytes, never from its name.
 */
export const MEDIA_LIMITS = {
  MAX_BYTES: 250 * 1024,
  NAME_MAX: 120,
  PAGE_SIZE: 60,
} as const;

/** What the library holds, by what the file is, not by what it is for. */
export const MEDIA_FORMATS = {
  png: { kind: 'image', mime: 'image/png' },
  jpeg: { kind: 'image', mime: 'image/jpeg' },
  webp: { kind: 'image', mime: 'image/webp' },
  lottie: { kind: 'motion', mime: 'application/json' },
  webm: { kind: 'motion', mime: 'video/webm' },
  mp4: { kind: 'motion', mime: 'video/mp4' },
} as const;
export type MediaFormatId = keyof typeof MEDIA_FORMATS;

/** What a file input offers; the API still reads the bytes. */
export const MEDIA_ACCEPT = 'image/png,image/jpeg,image/webp,application/json,.json,video/webm,video/mp4';

/** The library's shelves — an admin's choice, for finding a file again. */
export const MEDIA_CATEGORIES = ['mascot', 'cover', 'question', 'answer_motion', 'celebration', 'result', 'other'] as const;
export type MediaCategoryId = (typeof MEDIA_CATEGORIES)[number];

export const MEDIA_CATEGORY_LABELS: Record<MediaCategoryId, string> = {
  mascot: 'مسکات',
  cover: 'کاور',
  question: 'تصویر سؤال',
  answer_motion: 'موشن پاسخ',
  celebration: 'جشن و پایان',
  result: 'کارت نتیجه',
  other: 'سایر',
};

/** The simple effects the product draws itself, when no file is chosen. */
export const BUILTIN_MOTION_EFFECTS = ['confetti', 'pop', 'sparkle', 'thumbs_up'] as const;
export type BuiltinMotionEffectId = (typeof BUILTIN_MOTION_EFFECTS)[number];

export const BUILTIN_MOTION_EFFECT_LABELS: Record<BuiltinMotionEffectId, string> = {
  confetti: 'کاغذرنگی',
  pop: 'پاپ',
  sparkle: 'درخشش',
  thumbs_up: 'لایک',
};

/** How long a motion stays on screen; an answer's is 0.8–1.5 s by default. */
export const MOTION_DURATION = {
  MIN_MS: 500,
  MAX_MS: 5000,
  ANSWER_MS: 1200,
  DAY_COMPLETE_MS: 2500,
  JOURNEY_COMPLETE_MS: 3500,
  CAPTION_MAX: 80,
  RANDOM_MAX: 12,
} as const;

export const ENGAGEMENT_PAGE_SIZE = 20;

/** Text answers shown per question on the results dashboard. */
export const ENGAGEMENT_TEXT_SAMPLE_SIZE = 20;
