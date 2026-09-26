import type { Metadata } from 'next';

import { APP_NAME } from '@hamdastan/config';

import { requirePermission } from '@/features/auth/server';
import { FormBuilderScreen, type BuilderTab } from '@/features/forms';
import { loadForm } from '@/features/forms/server';

/**
 * Entry point for the form builder.
 *
 * The document is read on the server and handed over once; everything after
 * that is the builder's, including the autosave. `?tab=preview` is what the
 * dashboard's «پیش‌نمایش» action links to, so one screen serves both.
 */

export const metadata: Metadata = {
  title: `ویرایش فرم | پنل مدیریت ${APP_NAME}`,
};

export const dynamic = 'force-dynamic';

const TABS = new Set(['build', 'logic', 'settings', 'preview']);

export default async function FormBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission('forms.edit');

  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const form = await loadForm(id);

  return (
    <FormBuilderScreen
      initialForm={form}
      initialTab={tab && TABS.has(tab) ? (tab as BuilderTab) : 'build'}
    />
  );
}
