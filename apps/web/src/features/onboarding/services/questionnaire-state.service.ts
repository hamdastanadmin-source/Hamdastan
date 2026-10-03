import { cookies } from 'next/headers';

import type { QuestionnaireState } from '@hamdastan/types';

import { HttpError, onboardingService } from '@/services';

/**
 * The questionnaire as `apps/api` holds it, read on the server so the page
 * opens on the right screen with every saved answer already in place.
 *
 * Null when the API refuses because stage 1 is not saved yet — the page
 * sends the person back there. Anything else is a real failure and is left
 * to the error boundary rather than shown as an empty questionnaire.
 */
export async function getQuestionnaireState(): Promise<QuestionnaireState | null> {
  const cookie = (await cookies()).toString();
  try {
    return await onboardingService.getQuestionnaire({ cookie });
  } catch (error) {
    if (error instanceof HttpError && error.status === 403) return null;
    throw error;
  }
}
