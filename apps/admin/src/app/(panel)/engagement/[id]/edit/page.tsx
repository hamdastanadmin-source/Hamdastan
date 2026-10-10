import type { Metadata } from 'next';

import { ActivityEditor, EDITOR_STEPS, type EditorStepId } from '@/features/engagement';
import { requireAdminPermission } from '@/features/auth/server';
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
  // Read access is enough to open it: «پیش‌نمایش» lives here. Saving and
  // publishing are hidden without their permissions, and refused by the API.
  await requireAdminPermission('activities.read');
  const [{ id }, { step }] = await Promise.all([params, searchParams]);
  const activity = await getActivity(id);
  const initialStep = EDITOR_STEPS.some((s) => s.id === step) ? (step as EditorStepId) : 'type';
  return <ActivityEditor key={activity.id} initial={activity} initialStep={initialStep} />;
}
