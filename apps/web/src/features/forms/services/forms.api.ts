/**
 * The public form's calls to `apps/api`.
 *
 * The only file in this feature that names a route. A respondent's browser
 * talks to our backend and to nothing else — the form, its questions and the
 * answers all travel through `apps/api`, which is also what decides whether
 * this visitor may answer at all.
 */

import { SESSION_COOKIE_NAME } from '@hamdastan/config';
import type { Form, FormAnswer, FormResponse } from '@hamdastan/types';

import { apiClient } from '@/services';

export const formsApi = {
  /**
   * The form, if it is open and this visitor is in its audience.
   *
   * Read while rendering on the server, so the session cookie is forwarded by
   * hand; a form limited to an audience is refused by the backend, not hidden
   * by the page. Never cached — a form closes on a date, and a cached copy
   * would keep letting people in.
   */
  get(id: string, token?: string) {
    return apiClient.get<{ form: Form }>(`/forms/${id}`, {
      headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
      cache: 'no-store',
    });
  },

  /** Submits the answers. `complete: false` is a draft between pages. */
  submit(id: string, answers: FormAnswer[], complete: boolean, elapsedSeconds?: number) {
    return apiClient.post<{ response: FormResponse }>(`/forms/${id}/responses`, {
      answers,
      complete,
      ...(elapsedSeconds === undefined ? {} : { elapsedSeconds }),
    });
  },
};
