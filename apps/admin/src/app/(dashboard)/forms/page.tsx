import type { Metadata } from 'next';

import { APP_NAME } from '@hamdastan/config';
import type { FormStatus, FormsQuery } from '@hamdastan/types';

import { requirePermission } from '@/features/auth/server';
import { FormsScreen } from '@/features/forms';
import { loadFormsDashboard } from '@/features/forms/server';

/**
 * Entry point for `/forms`.
 *
 * It checks that this admin may be here, reads the query string, and hands the
 * data to the feature. The permission decides whether the screen renders;
 * `apps/api` decides whether the data comes back, and it checks the same one.
 */

export const metadata: Metadata = {
  title: `فرم‌ها و نظرسنجی‌ها | پنل مدیریت ${APP_NAME}`,
};

export const dynamic = 'force-dynamic';

export default async function FormsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; sort?: string; page?: string }>;
}) {
  await requirePermission('forms.view');

  const params = await searchParams;
  const page = Number(params.page);

  const query: FormsQuery = {
    ...(params.search ? { search: params.search } : {}),
    ...(params.status ? { status: params.status as FormStatus } : {}),
    ...(params.sort ? { sort: params.sort as FormsQuery['sort'] } : {}),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };

  const { overview, page: forms, templates } = await loadFormsDashboard(query);

  return <FormsScreen overview={overview} page={forms} templates={templates} query={query} />;
}
