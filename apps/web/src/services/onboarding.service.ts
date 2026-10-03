import type { QuestionId } from '@hamdastan/config';
import type {
  OnboardingEventInput,
  OnboardingInterests,
  QuestionnaireAnswer,
  QuestionnaireState,
  SessionResponse,
} from '@hamdastan/types';
import type { InterestsInput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/**
 * Every onboarding route, named once.
 *
 * A call made while rendering on the server has no cookie jar of its own;
 * the caller passes the request's own `cookie` header through.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) =>
  options?.cookie ? { headers: { cookie: options.cookie } } : {};

export const onboardingService = {
  getInterests(options?: ServerCall): Promise<OnboardingInterests> {
    return apiClient.get<OnboardingInterests>('/me/onboarding/interests', {
      ...withCookie(options),
      cache: 'no-store',
    });
  },

  saveInterests(input: InterestsInput): Promise<OnboardingInterests> {
    return apiClient.put<OnboardingInterests>('/me/onboarding/interests', input);
  },

  // ─── Stage 2 — the questionnaire ───────────────────────────────────────

  getQuestionnaire(options?: ServerCall): Promise<QuestionnaireState> {
    return apiClient.get<QuestionnaireState>('/me/onboarding/questionnaire', {
      ...withCookie(options),
      cache: 'no-store',
    });
  },

  /** Saves one answer; the API rebuilds the profile from all of them and answers with the new state. */
  saveAnswer(questionId: QuestionId, answer: QuestionnaireAnswer): Promise<QuestionnaireState> {
    return apiClient.put<QuestionnaireState>(
      `/me/onboarding/questionnaire/answers/${questionId}`,
      { answer }
    );
  },

  completeQuestionnaire(): Promise<QuestionnaireState> {
    return apiClient.post<QuestionnaireState>('/me/onboarding/questionnaire/complete');
  },

  /** Ends onboarding. The answer's `nextStep` is where to go. */
  completeOnboarding(): Promise<SessionResponse> {
    return apiClient.post<SessionResponse>('/me/onboarding/complete');
  },

  /** `keepalive`: an event sent as the page navigates away still arrives. */
  trackEvent(input: OnboardingEventInput): Promise<null> {
    return apiClient.post<null>('/me/onboarding/events', input, { keepalive: true });
  },
};
