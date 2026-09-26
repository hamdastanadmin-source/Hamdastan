import type { Metadata } from 'next';
import { Frown } from 'lucide-react';

import { APP_NAME } from '@hamdastan/config';
import { Alert, AlertDescription, AlertTitle } from '@hamdastan/ui';

import { PublicFormView } from '@/features/forms';
import { loadForm } from '@/features/forms/server';

/**
 * Entry point for `/forms/{id}` — the link an admin shares after publishing.
 *
 * It asks the backend for the form and renders whichever answer it gets: the
 * form, or the reason there is none. Nothing is decided here — whether this
 * visitor may answer, whether the window is open and whether they have already
 * answered are all the backend's calls.
 */

export const metadata: Metadata = {
  title: `فرم | ${APP_NAME}`,
};

/** The answer depends on who is asking and on today's date, so never prerender. */
export const dynamic = 'force-dynamic';

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await loadForm(id);

  if (access.state === 'OPEN') {
    return <PublicFormView form={access.form} />;
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16">
      <Alert>
        <Frown className="size-4" />
        <AlertTitle>این فرم در دسترس نیست</AlertTitle>
        <AlertDescription>{access.message}</AlertDescription>
      </Alert>
    </main>
  );
}
