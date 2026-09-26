'use client';

import { useState } from 'react';

import type { Form, FormAnswer } from '@hamdastan/types';
import { Card, CardContent, FormRunner } from '@hamdastan/ui';

import { HttpError } from '@/services';

import { formsApi } from '../services/forms.api';

/**
 * A published form, as somebody answering it sees it.
 *
 * The walk through the form — pages, progress, what is visible, what is still
 * missing — is `FormRunner`'s, from the design system, which is the same
 * component the admin panel previews with. What this adds is the one thing a
 * preview does not do: send the answers.
 *
 * No product navigation around it on purpose. Somebody arriving from a link
 * should see the form and nothing else.
 */
export function PublicFormView({ form }: { form: Form }) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const submit = async (answers: FormAnswer[]) => {
    setSubmitting(true);
    setError(undefined);

    try {
      await formsApi.submit(
        form.id,
        answers,
        true,
        Math.round((Date.now() - startedAt) / 1000)
      );
    } catch (caught) {
      // The backend re-checks every rule the runner applied, so its refusal is
      // the authoritative one and is already in Persian.
      setError(
        caught instanceof HttpError
          ? caught.message
          : 'ثبت پاسخ ممکن نشد. دوباره تلاش کنید.'
      );
      setSubmitting(false);
      // Rethrowing keeps the runner on the last page instead of showing the
      // thank-you screen for a submission that never landed.
      throw caught;
    }

    setSubmitting(false);
  };

  return (
    /* A div, not a <main>: the layout owns the landmark — with the app shell
       for a signed-in user, and on its own for somebody following a link. */
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <div className="mb-6 space-y-2">
        <h1 className="text-xl font-bold sm:text-2xl">{form.title}</h1>
        {form.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{form.description}</p>
        )}
      </div>

      <Card>
        <CardContent className="p-5 sm:p-8">
          <FormRunner
            form={form}
            onSubmit={submit}
            error={error}
            submitting={submitting}
          />
        </CardContent>
      </Card>
    </div>
  );
}
