import type { Metadata } from 'next';

import { APP_NAME } from '@hamdastan/config';

import { requirePermission } from '@/features/auth/server';
import { ResponsesScreen } from '@/features/forms';
import { loadResponses } from '@/features/forms/server';

/**
 * Entry point for a form's responses.
 *
 * The form, its statistics and the first page of responses are read together —
 * three independent calls, so they go in parallel — and handed to the feature.
 */

export const metadata: Metadata = {
  title: `پاسخ‌های فرم | پنل مدیریت ${APP_NAME}`,
};

export const dynamic = 'force-dynamic';

export default async function FormResponsesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission('forms.responses.view');

  const [{ id }, { page }] = await Promise.all([params, searchParams]);
  const parsed = Number(page);

  const { form, stats, responses } = await loadResponses(
    id,
    Number.isInteger(parsed) && parsed > 0 ? parsed : 1
  );

  return <ResponsesScreen form={form} stats={stats} responses={responses} />;
}
