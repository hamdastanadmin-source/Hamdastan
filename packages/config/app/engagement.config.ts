/**
 * Engagement Studio — the activities the admin panel designs and the product
 * plays: surveys, missions and assessments.
 *
 * The limits are here because both sides hold an activity to them: the
 * builder in `apps/admin` stops at them, and `apps/api` refuses anything
 * past them. The labels are here because both apps print them.
 */

export const ACTIVITY_TYPES = ['survey', 'mission', 'assessment'] as const;
export type ActivityTypeId = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityTypeId, string> = {
  survey: 'نظرسنجی',
  mission: 'مأموریت',
  assessment: 'آزمون',
};

export const QUESTION_KINDS = ['single', 'multiple', 'text', 'rating', 'scale'] as const;
export type QuestionKindId = (typeof QUESTION_KINDS)[number];

export const QUESTION_KIND_LABELS: Record<QuestionKindId, string> = {
  single: 'تک‌گزینه‌ای',
  multiple: 'چندگزینه‌ای',
  text: 'متنی',
  rating: 'امتیازی',
  scale: 'طیفی',
};

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
  REASON_MAX: 300,
} as const;

export const ENGAGEMENT_PAGE_SIZE = 20;

/** Text answers shown per question on the results dashboard. */
export const ENGAGEMENT_TEXT_SAMPLE_SIZE = 20;
