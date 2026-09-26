/**
 * Reading forms while rendering on the server.
 *
 * Server-only: it forwards the admin's session cookie out of the incoming
 * request. Exported through the feature's `server.ts`, so a client component
 * cannot pull `next/headers` into its bundle.
 *
 * The permission checks are not here — `requirePermission` decides whether the
 * page renders and `apps/api` decides whether the data comes back. This asks.
 */

import type {
  Form,
  FormResponse,
  FormStats,
  FormSummary,
  FormTemplate,
  FormsOverview,
  FormsQuery,
  Paginated,
} from '@hamdastan/types';

import { adminSessionHeaders } from '@/lib/server-request';

import { formsApi } from './forms.api';

export async function loadFormsDashboard(query: FormsQuery): Promise<{
  overview: FormsOverview;
  page: Paginated<FormSummary>;
  templates: FormTemplate[];
}> {
  const headers = await adminSessionHeaders();

  // Three independent reads, so they go together rather than one after another.
  const [overview, page, { templates }] = await Promise.all([
    formsApi.overview(headers),
    formsApi.list(query, headers),
    formsApi.templates(headers),
  ]);

  return { overview, page, templates };
}

export async function loadForm(id: string): Promise<Form> {
  const { form } = await formsApi.get(id, await adminSessionHeaders());
  return form;
}

export async function loadResponses(
  id: string,
  page: number
): Promise<{ form: Form; stats: FormStats; responses: Paginated<FormResponse> }> {
  const headers = await adminSessionHeaders();

  const [{ form }, stats, responses] = await Promise.all([
    formsApi.get(id, headers),
    formsApi.stats(id, headers),
    formsApi.responses(id, page, headers),
  ]);

  return { form, stats, responses };
}
