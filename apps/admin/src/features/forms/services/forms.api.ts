/**
 * «فرم‌ها و نظرسنجی‌ها»'s calls to `apps/api`.
 *
 * The only file in the feature that names a route. Every decision behind these
 * calls is the backend's: who may author a form, whether it can be published,
 * who may answer it, and what the statistics are. The panel asks and renders.
 *
 * The builder's autosave is `update`, which sends only what changed.
 */

import type {
  CreateFormRequest,
  Form,
  FormResponse,
  FormStats,
  FormSummary,
  FormTemplate,
  FormsOverview,
  FormsQuery,
  Paginated,
  UpdateFormRequest,
  UploadAssetRequest,
  UploadAssetResponse,
} from '@hamdastan/types';

import { apiClient } from '@/services';

/** Where the export downloads from. A file, so the browser fetches it directly. */
export function exportUrl(formId: string, format: 'CSV' | 'EXCEL'): string {
  return `/api/v1/admin/forms/${formId}/responses/export?format=${format}`;
}

export const formsApi = {
  overview(headers: Record<string, string> = {}) {
    return apiClient.get<FormsOverview>('/admin/forms/overview', {
      headers,
      cache: 'no-store',
    });
  },

  list(query: FormsQuery, headers: Record<string, string> = {}) {
    return apiClient.get<Paginated<FormSummary>>('/admin/forms', {
      query: {
        ...(query.search ? { search: query.search } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.sort ? { sort: query.sort } : {}),
        ...(query.page ? { page: query.page } : {}),
      },
      headers,
      cache: 'no-store',
    });
  },

  templates(headers: Record<string, string> = {}) {
    return apiClient.get<{ templates: FormTemplate[] }>('/admin/forms/templates', {
      headers,
      cache: 'no-store',
    });
  },

  get(id: string, headers: Record<string, string> = {}) {
    return apiClient.get<{ form: Form }>(`/admin/forms/${id}`, {
      headers,
      cache: 'no-store',
    });
  },

  create(input: CreateFormRequest) {
    return apiClient.post<{ form: Form }>('/admin/forms', input);
  },

  /** The autosave. Whatever is passed replaces what is stored. */
  update(id: string, patch: UpdateFormRequest) {
    return apiClient.patch<{ form: Form }>(`/admin/forms/${id}`, patch);
  },

  publish(id: string) {
    return apiClient.post<{ form: Form }>(`/admin/forms/${id}/publish`);
  },

  unpublish(id: string) {
    return apiClient.post<{ form: Form }>(`/admin/forms/${id}/unpublish`);
  },

  close(id: string) {
    return apiClient.post<{ form: Form }>(`/admin/forms/${id}/close`);
  },

  duplicate(id: string) {
    return apiClient.post<{ form: Form }>(`/admin/forms/${id}/duplicate`);
  },

  remove(id: string) {
    return apiClient.delete<{ deleted: boolean }>(`/admin/forms/${id}`);
  },

  /**
   * Uploads a background image and answers with the URL to store on the
   * question. The bytes go to our backend and to nothing else.
   */
  uploadAsset(id: string, input: UploadAssetRequest) {
    return apiClient.post<UploadAssetResponse>(`/admin/forms/${id}/assets`, input);
  },

  responses(id: string, page: number, headers: Record<string, string> = {}) {
    return apiClient.get<Paginated<FormResponse>>(`/admin/forms/${id}/responses`, {
      query: { page },
      headers,
      cache: 'no-store',
    });
  },

  stats(id: string, headers: Record<string, string> = {}) {
    return apiClient.get<FormStats>(`/admin/forms/${id}/responses/stats`, {
      headers,
      cache: 'no-store',
    });
  },
};
