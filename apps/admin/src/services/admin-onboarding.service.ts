import type {
  AdminInterestCategory,
  AdminQuestion,
  InterestCategoryInput,
  QuestionInput,
} from '@hamdastan/types';
import type { InterestImportInput, QuestionnaireImportInput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/** The onboarding catalogs' routes in the panel — stage 1's interests, stage 2's questions — named once. */

const base = '/admin/onboarding';

export const adminOnboardingService = {
  interestCategories() {
    return apiClient.get<AdminInterestCategory[]>(`${base}/interest-categories`, { cache: 'no-store' });
  },

  createInterestCategory(input: InterestCategoryInput) {
    return apiClient.post<AdminInterestCategory[]>(`${base}/interest-categories`, input);
  },

  updateInterestCategory(id: string, input: InterestCategoryInput) {
    return apiClient.put<AdminInterestCategory[]>(`${base}/interest-categories/${id}`, input);
  },

  /** The Excel import: interests into matching categories or new ones, in one write. */
  importInterests(input: InterestImportInput) {
    return apiClient.post<AdminInterestCategory[]>(`${base}/interest-categories/import`, input);
  },

  reorderInterestCategories(ids: string[]) {
    return apiClient.put<AdminInterestCategory[]>(`${base}/interest-categories/order`, { ids });
  },

  removeInterestCategory(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/interest-categories/${id}`);
  },

  questions() {
    return apiClient.get<AdminQuestion[]>(`${base}/questions`, { cache: 'no-store' });
  },

  createQuestion(input: QuestionInput) {
    return apiClient.post<AdminQuestion[]>(`${base}/questions`, input);
  },

  updateQuestion(id: string, input: QuestionInput) {
    return apiClient.put<AdminQuestion[]>(`${base}/questions/${id}`, input);
  },

  /** The Excel import: every question appended, unscored, in one write. */
  importQuestions(input: QuestionnaireImportInput) {
    return apiClient.post<AdminQuestion[]>(`${base}/questions/import`, input);
  },

  reorderQuestions(ids: string[]) {
    return apiClient.put<AdminQuestion[]>(`${base}/questions/order`, { ids });
  },

  removeQuestion(id: string) {
    return apiClient.delete<{ deleted: true }>(`${base}/questions/${id}`);
  },
};
