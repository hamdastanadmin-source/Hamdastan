import type { QuestionId, SectionId } from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers } from '@hamdastan/types';

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
