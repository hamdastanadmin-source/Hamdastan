import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireSession } from '@/features/auth/server';
import { QuestionnaireFlow } from '@/features/onboarding';
import { getQuestionnaireState } from '@/features/onboarding/server';

export const metadata: Metadata = { title: 'بیشتر بشناسیمت' };
export const dynamic = 'force-dynamic';

/**
 * Onboarding stage 2. Stage 1 comes first; the API is what says it has not.
 *
 * It can be put off, so an account past onboarding reaches it too — from
 * the mission on home or the profile. Once that account has finished it,
 * the result lives in the profile.
 */
export default async function OnboardingQuestionnairePage() {
  const { nextStep } = await requireSession();
  const state = await getQuestionnaireState();
  if (!state) redirect('/onboarding/interests');

  const pastOnboarding = nextStep === 'home';
  if (pastOnboarding && state.completed) redirect('/profile/social');

  return (
    <QuestionnaireFlow initialState={state} exitHref={pastOnboarding ? '/' : '/onboarding/interests'} />
  );
}
