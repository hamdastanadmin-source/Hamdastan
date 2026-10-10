import type { Metadata } from 'next';

import { ActivityEditor, EDITOR_STEPS, type EditorStepId } from '@/features/engagement';
import { getActivity } from '@/features/engagement/server';

export const metadata: Metadata = { title: 'ویرایش فعالیت' };

/** `?step=preview` opens a step directly — the list's «پیش‌نمایش» uses it. */
export default async function EditActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ id }, { step }] = await Promise.all([params, searchParams]);
  const activity = await getActivity(id);
  const initialStep = EDITOR_STEPS.some((s) => s.id === step) ? (step as EditorStepId) : 'type';
  return <ActivityEditor key={activity.id} initial={activity} initialStep={initialStep} />;
}
