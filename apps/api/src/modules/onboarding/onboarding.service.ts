import { presentationIndexOf, type QuestionId } from '@hamdastan/config';
import type {
  Gender,
  QuestionnaireAnswer,
  QuestionnaireAnswers,
  QuestionnaireCompletion,
  QuestionnaireResult,
  QuestionnaireState,
} from '@hamdastan/types';
import type { OnboardingEventBody } from '@hamdastan/validation';

import { ForbiddenError, ValidationError } from '../../shared/errors';
import { missionsService } from '../missions';
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

/** What the card needs from outside the questionnaire: stage 1's interests, and the gender that picks the character. */
type ResultContext = { interestIds: readonly string[]; gender: Gender | null };

/**
 * What the browser is allowed to see: its answers, its place, and the card
 * once it has earned it.
 */
export function toQuestionnaireState(
  record: QuestionnaireRecord,
  { interestIds, gender }: ResultContext
): QuestionnaireState {
  const { currentQuestionId, progress } = resumePoint(record.answers);
  return {
    answers: record.answers,
    resumeQuestionId: currentQuestionId,
    progress,
    completed: record.completed,
    result: record.completed ? buildResult(computeProfile(record.answers), interestIds, gender) : null,
  };
}

async function resultContext(userId: string): Promise<ResultContext & { onboardingStage: number }> {
  const [{ onboardingStage, interestIds }, { gender }] = await Promise.all([
    usersService.getOnboardingInterests(userId),
    usersService.getById(userId),
  ]);
  return { onboardingStage, interestIds, gender };
}

/** Stage 2 follows stage 1: no answers before the interests are saved. Answers with what the card needs. */
async function requireInterestsSaved(userId: string): Promise<ResultContext> {
  const { onboardingStage, ...context } = await resultContext(userId);
  if (onboardingStage < 1) throw new ForbiddenError('اول علاقه‌مندی‌هات رو انتخاب کن');
  return context;
}

export const onboardingService = {
  async getQuestionnaire(userId: string): Promise<QuestionnaireState> {
    const context = await requireInterestsSaved(userId);
    return toQuestionnaireState(await onboardingRepository().findQuestionnaire(userId), context);
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
    const context = await requireInterestsSaved(userId);
    const record = await onboardingRepository().saveAnswer(
      userId,
      { questionId, answer, presentationIndex: presentationIndexOf(questionId) },
      deriveQuestionnaire
    );
    return toQuestionnaireState(record, context);
  },

  /**
   * Finishing is the server's call: every question has to have an answer.
   * Idempotent, reward included — the personality-test mission pays once
   * however many times this is called, and a call that failed half-way
   * grants it on the retry.
   */
  async complete(userId: string): Promise<QuestionnaireCompletion> {
    const context = await requireInterestsSaved(userId);
    const record = await onboardingRepository().findQuestionnaire(userId);
    if (!isComplete(record.answers)) {
      throw new ValidationError('هنوز به چند سؤال جواب ندادی');
    }
    if (!record.completed) await onboardingRepository().markCompleted(userId);
    const xpAwarded = await missionsService.complete(userId, 'personality_test');
    return { ...toQuestionnaireState({ ...record, completed: true }, context), xpAwarded };
  },

  /** The result card once the questionnaire is finished; null before. For the account area. */
  async getResult(userId: string): Promise<QuestionnaireResult | null> {
    const [record, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(userId),
      resultContext(userId),
    ]);
    return toQuestionnaireState(record, context).result;
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
