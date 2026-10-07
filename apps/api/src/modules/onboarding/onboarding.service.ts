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
import { usersService, type UserRecord } from '../users';

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

/** What the result card needs beyond the answers. Only read when there is a card to build. */
async function resultContext(user: UserRecord): Promise<ResultContext> {
  const { interestIds } = await usersService.getOnboardingInterests(user);
  return { interestIds, gender: user.gender };
}

/** The state, reading the card's context only when the questionnaire is finished. */
async function stateOf(user: UserRecord, record: QuestionnaireRecord): Promise<QuestionnaireState> {
  const context = record.completed ? await resultContext(user) : { interestIds: [], gender: user.gender };
  return toQuestionnaireState(record, context);
}

/** Stage 2 follows stage 1: no answers before the interests are saved. */
function requireInterestsSaved(user: UserRecord): void {
  if (user.onboardingStage < 1) throw new ForbiddenError('اول علاقه‌مندی‌هات رو انتخاب کن');
}

/**
 * Every method takes the `UserRecord` `authenticate` loaded for this
 * request, so none of them reads the user row again.
 */
export const onboardingService = {
  async getQuestionnaire(user: UserRecord): Promise<QuestionnaireState> {
    requireInterestsSaved(user);
    const [record, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      resultContext(user),
    ]);
    return toQuestionnaireState(record, context);
  },

  /**
   * One answer, already validated against its question. The presentation
   * index is looked up here, never taken from the request.
   */
  async saveAnswer(
    user: UserRecord,
    questionId: QuestionId,
    answer: QuestionnaireAnswer
  ): Promise<QuestionnaireState> {
    requireInterestsSaved(user);
    const record = await onboardingRepository().saveAnswer(
      user.id,
      { questionId, answer, presentationIndex: presentationIndexOf(questionId) },
      deriveQuestionnaire
    );
    return stateOf(user, record);
  },

  /**
   * Finishing is the server's call: every question has to have an answer.
   * Idempotent, reward included — the personality-test mission pays once
   * however many times this is called, and a call that failed half-way
   * grants it on the retry.
   */
  async complete(user: UserRecord): Promise<QuestionnaireCompletion> {
    requireInterestsSaved(user);
    const [record, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      resultContext(user),
    ]);
    if (!isComplete(record.answers)) {
      throw new ValidationError('هنوز به چند سؤال جواب ندادی');
    }
    if (!record.completed) await onboardingRepository().markCompleted(user.id);
    const xpAwarded = await missionsService.complete(user.id, 'personality_test');
    return { ...toQuestionnaireState({ ...record, completed: true }, context), xpAwarded };
  },

  /** The result card once the questionnaire is finished; null before. For the account area. */
  async getResult(user: UserRecord): Promise<QuestionnaireResult | null> {
    const [record, context] = await Promise.all([
      onboardingRepository().findQuestionnaire(user.id),
      resultContext(user),
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
