import type { QuestionId, QuestionOption, SectionId } from '@hamdastan/config';
import type { QuestionInput, QuestionnaireAnswer, QuestionnaireAnswers } from '@hamdastan/types';

import type { ResumePoint, SocialProfile } from './onboarding.scoring';

/**
 * Types internal to the Onboarding module.
 *
 * What leaves the API is `QuestionnaireState` in `@hamdastan/types`; these
 * are what the repository reads and writes.
 */

/** What is stored for a person: the raw answers, and whether they finished. */
export type QuestionnaireRecord = {
  answers: QuestionnaireAnswers;
  completed: boolean;
};

/** Everything derived from the answers, written whole on every save. */
export type DerivedQuestionnaire = SocialProfile & ResumePoint;

export type AnswerToSave = {
  questionId: QuestionId;
  answer: QuestionnaireAnswer;
  presentationIndex: number;
};

export type OnboardingEventRecord = {
  event: string;
  questionId: QuestionId | null;
  presentationIndex: number | null;
  sectionId: SectionId | null;
  properties: Record<string, unknown>;
};

/** One selected interest, with the category the server looked up for it. */
export type InterestSelection = { interestId: string; categoryId: string };

/** A category as it is written: every interest already has its id, in order. */
export type InterestCategoryFields = {
  title: string;
  interests: { id: string; label: string }[];
};

/** A question as it is written: every option already has its code, in order. */
export type QuestionFields = Omit<QuestionInput, 'options'> & { options: QuestionOption[] };
