/**
 * Onboarding stage 2 — the social questionnaire, as `apps/api` returns it.
 *
 * The browser sees the answers it gave, where to resume, and — once the
 * questionnaire is complete — a simplified result card. The full internal
 * profile (fourteen dimensions, role scores, conflict sensitivities) stays on
 * the server: it is for matching, not for display.
 */

import type { OnboardingEventName, QuestionId, SectionId } from '@hamdastan/config';

/** One stored answer. Which shape depends on the question's `kind`. */
export type QuestionnaireAnswer =
  | { option: string }
  | { options: string[] }
  | { ranked: string[] }
  | { value: number };

export type QuestionnaireAnswers = Partial<Record<QuestionId, QuestionnaireAnswer>>;

/** One bar on the result card, 1–10. */
export type ResultDimension = {
  key: string;
  label: string;
  value: number;
  /** For a two-ended scale («گفتگو ↔ فعالیت»): the labels at 1 and at 10. */
  minLabel?: string;
  maxLabel?: string;
};

/** One plain-language reading of the profile: «توی گروه ترجیح می‌دی» → «ساختار منعطف». */
export type ResultInsight = { key: string; label: string; value: string };

/** Stage 1's picks in one category, as labels: «هنر و خلاقیت» → «عکاسی»، «نقاشی». */
export type ResultInterestGroup = { key: string; title: string; interests: string[] };

/**
 * The simplified interpretation shown once — meaning first, numbers last.
 * The profile itself is richer and never reduced to this.
 */
export type QuestionnaireResult = {
  title: string;
  description: string;
  /** Three, always: energy, what they look for, how they like a group to run. */
  insights: ResultInsight[];
  /** What the person picked in stage 1, grouped by category in catalog order. */
  interests: ResultInterestGroup[];
  /** Behind «جزئیات بیشتر». */
  dimensions: ResultDimension[];
};

export type QuestionnaireState = {
  answers: QuestionnaireAnswers;
  /** The first unanswered question in presentation order; null when none is left. */
  resumeQuestionId: QuestionId | null;
  /** 0–100. */
  progress: number;
  completed: boolean;
  /** Present once `completed`. */
  result: QuestionnaireResult | null;
};

/**
 * What finishing answers with. `xpAwarded` is the personality-test reward
 * when this call earned it, and 0 when it had been earned before — so the
 * screen celebrates once.
 */
export type QuestionnaireCompletion = QuestionnaireState & { xpAwarded: number };

export type OnboardingEventInput = {
  event: OnboardingEventName;
  questionId?: QuestionId;
  sectionId?: SectionId;
  properties?: {
    answerType?: 'single' | 'multi' | 'ranked' | 'slider';
    timeSpentMs?: number;
    selectionCount?: number;
  };
};
