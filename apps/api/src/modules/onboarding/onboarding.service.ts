import { presentationIndexOf, type QuestionId } from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers, QuestionnaireState } from '@hamdastan/types';
import type { OnboardingEventBody } from '@hamdastan/validation';

import { ForbiddenError, ValidationError } from '../../shared/errors';
import { usersService } from '../users';

import { onboardingRepository } from './onboarding.repository';
import { buildResult } from './onboarding.result';
import { computeProfile, isComplete, resumePoint } from './onboarding.scoring';
import type { DerivedQuestionnaire, QuestionnaireRecord } from './onboarding.types';

/**
 * Business logic for onboarding stage 2 — the social questionnaire.
 *
 * Every save goes the same way: store the raw answer, then rebuild the whole
 * profile from all of the stored answers (`derive`). Nothing is added to a
 * running total, so an edited answer replaces its old contribution rather
 * than stacking on it, and the result is the same however the person got
 * there.
 */

/** The whole derived row: the profile, and where to resume. */
export function deriveQuestionnaire(answers: QuestionnaireAnswers): DerivedQuestionnaire {
  return { ...computeProfile(answers), ...resumePoint(answers) };
}

/** What the browser is allowed to see: its answers, its place, and the card once it has earned it. */
export function toQuestionnaireState(record: QuestionnaireRecord): QuestionnaireState {
  const { currentQuestionId, progress } = resumePoint(record.answers);
  return {
    answers: record.answers,
    resumeQuestionId: currentQuestionId,
    progress,
    completed: record.completed,
    result: record.completed ? buildResult(computeProfile(record.answers)) : null,
  };
}

/** Stage 2 follows stage 1: no answers before the interests are saved. */
async function requireInterestsSaved(userId: string): Promise<void> {
  const { onboardingStage } = await usersService.getOnboardingInterests(userId);
  if (onboardingStage < 1) throw new ForbiddenError('اول علاقه‌مندی‌هات رو انتخاب کن');
}

export const onboardingService = {
  async getQuestionnaire(userId: string): Promise<QuestionnaireState> {
    await requireInterestsSaved(userId);
    return toQuestionnaireState(await onboardingRepository().findQuestionnaire(userId));
  },

  /**
   * One answer, already validated against its question. The presentation
   * index is looked up here, never taken from the request.
   */
  async saveAnswer(
    userId: string,
    questionId: QuestionId,
    answer: QuestionnaireAnswer
  ): Promise<QuestionnaireState> {
    await requireInterestsSaved(userId);
    const record = await onboardingRepository().saveAnswer(
      userId,
      { questionId, answer, presentationIndex: presentationIndexOf(questionId) },
      deriveQuestionnaire
    );
    return toQuestionnaireState(record);
  },

  /** Finishing is the server's call: every question has to have an answer. Idempotent. */
  async complete(userId: string): Promise<QuestionnaireState> {
    await requireInterestsSaved(userId);
    const record = await onboardingRepository().findQuestionnaire(userId);
    if (!isComplete(record.answers)) {
      throw new ValidationError('هنوز به چند سؤال جواب ندادی');
    }
    if (!record.completed) await onboardingRepository().markCompleted(userId);
    return toQuestionnaireState({ ...record, completed: true });
  },

  async recordEvent(userId: string, body: OnboardingEventBody): Promise<void> {
    await onboardingRepository().recordEvent(userId, {
      event: body.event,
      questionId: body.questionId ?? null,
      presentationIndex: body.questionId ? presentationIndexOf(body.questionId) : null,
      sectionId: (body.sectionId as 1 | 2 | 3 | 4 | undefined) ?? null,
      properties: body.properties ?? {},
    });
  },
};
