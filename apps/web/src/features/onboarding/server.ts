/**
 * Onboarding — server-only surface.
 *
 * Kept apart from `./index` so a client component cannot pull `next/headers`
 * into its bundle by accident.
 */

export { getOnboardingInterests } from './services/onboarding-interests.service';
export { getQuestionnaireState } from './services/questionnaire-state.service';
