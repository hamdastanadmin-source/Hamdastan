/**
 * Reading a form while rendering on the server.
 *
 * Server-only: it forwards the session cookie out of the incoming request,
 * which `next/headers` is the only way to reach. Exported through the feature's
 * `server.ts` so a client component cannot pull it into a bundle.
 */

import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { Form } from '@hamdastan/types';

import { HttpError } from '@/services';

import { formsApi } from './forms.api';

export type FormAccess =
  | { state: 'OPEN'; form: Form }
  /** The backend refused, and said why in Persian. */
  | { state: 'UNAVAILABLE'; code: string; message: string };

/**
 * The form, or the reason there is no form to show.
 *
 * Every refusal — not published, closed, not yet open, already answered, wrong
 * audience — is the backend's decision. The page renders whichever answer it
 * gets rather than deciding anything for itself.
 */
export async function loadForm(id: string): Promise<FormAccess> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  try {
    const { form } = await formsApi.get(id, token);
    return { state: 'OPEN', form };
  } catch (error) {
    if (error instanceof HttpError) {
      return { state: 'UNAVAILABLE', code: error.code, message: error.message };
    }
    throw error;
  }
}
