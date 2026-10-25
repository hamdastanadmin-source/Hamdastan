/**
 * Onboarding stage 2: the social questionnaire — the shape of a question,
 * the four sections they are shown in, and the sections' copy.
 *
 * The questions themselves are data (`v2_questionnaire_questions`), edited
 * from the admin panel; `apps/api` serves them in presentation order with the
 * person's answers, and validates every answer against them. The scoring
 * weights are the API's business
 * (`apps/api/src/modules/onboarding/onboarding.scoring.ts`).
 *
 * Two things are contracts and never change once answers are saved:
 *
 * - **Question ids.** Nothing scores off a position.
 * - **Option codes** are what `v2_questionnaire_answers` stores. A label can
 *   be reworded freely; a code cannot.
 */

/** Bumped whenever the scoring changes, so profiles can be recomputed. */
export const QUESTIONNAIRE_SCORING_VERSION = 'social-matching-v1';

/**
 * A question's id. The twenty scored questions keep the source
 * questionnaire's `Q1`–`Q20`; one added from the panel has a generated id.
 */
export type QuestionId = string;

export type SectionId = 1 | 2 | 3 | 4;

/**
 * - `single`  one option; the screen saves and moves on by itself.
 * - `multi`   up to `maxSelections`; the person continues by hand.
 * - `ranked`  a `multi` whose picks are then put in order of importance.
 * - `slider`  an integer from 1 to 10.
 */
export type QuestionKind = 'single' | 'multi' | 'ranked' | 'slider';

export type QuestionOption = { code: string; label: string };

type QuestionBase = { id: QuestionId; section: SectionId; title: string; helper?: string };

export type ChoiceQuestion = QuestionBase & {
  kind: 'single' | 'multi' | 'ranked';
  options: readonly QuestionOption[];
  /** `multi` and `ranked` only. Absent means "as many as apply". */
  maxSelections?: number;
};

export type SliderQuestion = QuestionBase & {
  kind: 'slider';
  /** The label at 1, shown at the reading start of the scale. */
  minLabel: string;
  /** The label at 10. */
  maxLabel: string;
};

export type Question = ChoiceQuestion | SliderQuestion;

/** The kinds as the admin panel and the Excel import name them. */
export const QUESTIONNAIRE_KIND_LABELS: Record<QuestionKind, string> = {
  single: 'تک‌انتخابی',
  multi: 'چندانتخابی',
  ranked: 'انتخاب و رتبه‌بندی',
  slider: 'طیف ۱ تا ۱۰',
};

export const SLIDER_MIN = 1;
export const SLIDER_MAX = 10;

export type QuestionnaireSection = {
  id: SectionId;
  /** The short beat after the section. The last section has none. */
  reward?: { title: string; body: string; cta: string };
};

/** The four chapters, as the admin panel and the Excel import name them. */
export const QUESTIONNAIRE_SECTION_LABELS: Record<SectionId, string> = {
  1: 'انرژی اجتماعی',
  2: 'سبک ارتباط',
  3: 'سبک تجربه',
  4: 'هماهنگی گروهی',
};

export const QUESTIONNAIRE_SECTIONS: readonly QuestionnaireSection[] = [
  {
    id: 1,
    reward: {
      title: 'کم‌کم داریم می‌شناسیمت.',
      body: 'حالا ببینیم چطور با آدم‌ها ارتباط می‌گیری.',
      cta: 'ادامه',
    },
  },
  {
    id: 2,
    reward: {
      title: 'خوبه، نصف راه.',
      body: 'حالا بریم سراغ تجربه‌هایی که بیشتر باهات جورند.',
      cta: 'ادامه',
    },
  },
  {
    id: 3,
    reward: {
      title: 'تقریباً کامل شد.',
      body: 'فقط چند انتخاب آخر مونده.',
      cta: 'بریم بخش آخر',
    },
  },
  { id: 4 },
];

/** The funnel events the questionnaire reports. `v2_onboarding_events.event`. */
export const ONBOARDING_EVENTS = [
  'quiz_started',
  'quiz_question_viewed',
  'quiz_question_answered',
  'quiz_back_clicked',
  'quiz_section_completed',
  'quiz_abandoned',
  'quiz_resumed',
  'quiz_completed',
  'quiz_result_viewed',
  'quiz_result_continue_clicked',
] as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENTS)[number];
