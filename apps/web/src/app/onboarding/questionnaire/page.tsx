import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { requireSession } from '@/features/auth/server';
import { QuestionnaireFlow } from '@/features/onboarding';
import { getQuestionnaireState } from '@/features/onboarding/server';

export const metadata: Metadata = { title: 'بیشتر بشناسیمت' };
export const dynamic = 'force-dynamic';

/** Onboarding stage 2. Stage 1 comes first; the API is what says it has not. */
export default async function OnboardingQuestionnairePage() {
  await requireSession();
  const state = await getQuestionnaireState();
  if (!state) redirect('/onboarding/interests');

  return <QuestionnaireFlow initialState={state} />;
}
