'use client';

import { useCallback, useState } from 'react';

import type { AdminArticleDetail, ArticleInput, ArticleStatusInput } from '@hamdastan/types';

import { adminContentService } from '@/services';

/**
 * The article as the API last answered it, and the two writes on it. Saving
 * creates it the first time; a status change saves first, so what is
 * published is what is on the screen.
 */
export function useArticleEditor(initial?: AdminArticleDetail) {
  const [saved, setSaved] = useState<AdminArticleDetail | undefined>(initial);

  const save = useCallback(
    async (input: ArticleInput): Promise<AdminArticleDetail> => {
      const detail = saved ? await adminContentService.update(saved.id, input) : await adminContentService.create(input);
      setSaved(detail);
      return detail;
    },
    [saved]
  );

  const changeStatus = useCallback(
    async (input: ArticleInput | null, status: ArticleStatusInput): Promise<AdminArticleDetail> => {
      const current = input ? await save(input) : saved;
      if (!current) throw new Error('article not saved');
      const detail = await adminContentService.changeStatus(current.id, status);
      setSaved(detail);
      return detail;
    },
    [save, saved]
  );

  return { saved, save, changeStatus };
}
