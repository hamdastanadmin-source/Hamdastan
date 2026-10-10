'use client';

import { useCallback, useState } from 'react';

import type { ActivityDefinition, AdminActivityDetail } from '@hamdastan/types';
import { activityInputSchema } from '@hamdastan/validation';

import { fieldErrors } from '@/lib';
import { adminEngagementService } from '@/services';

import {
  emptyState,
  fromDetail,
  stepOfPath,
  toInput,
  type EditorState,
  type EditorStepId,
} from '../utils/draft';

/**
 * The builder's state: the working copy, the errors under each field, and
 * saving. A save is checked with the same schema the API parses with, so a
 * problem lands under its field — and opens its step — before the request
 * is sent; what only the server can know comes back the same way.
 *
 * A new activity is created on its first save; from then on saves update
 * it, and the API decides whether that is an edit or a new version.
 */
export function useActivityEditor(initial?: AdminActivityDetail) {
  const [state, setState] = useState<EditorState>(() => (initial ? fromDetail(initial) : emptyState()));
  const [saved, setSaved] = useState<AdminActivityDetail | null>(initial ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const update = useCallback((patch: Partial<EditorState>) => setState((current) => ({ ...current, ...patch })), []);
  const updateDefinition = useCallback(
    (patch: Partial<ActivityDefinition>) =>
      setState((current) => ({ ...current, definition: { ...current.definition, ...patch } })),
    []
  );

  /** The step to open for the first problem, or null when the copy is valid. */
  const check = useCallback((): EditorStepId | null => {
    const result = activityInputSchema.safeParse(toInput(state));
    if (result.success) {
      setErrors({});
      return null;
    }
    const byPath: Record<string, string> = {};
    for (const issue of result.error.issues) byPath[issue.path.join('.')] ??= issue.message;
    setErrors(byPath);
    return stepOfPath(Object.keys(byPath)[0]);
  }, [state]);

  /** Saves; answers with the saved activity, or with the step that needs fixing. */
  const save = useCallback(async (): Promise<{ detail: AdminActivityDetail } | { step: EditorStepId }> => {
    const step = check();
    if (step) return { step };

    setBusy(true);
    try {
      const input = toInput(state);
      const detail = saved
        ? await adminEngagementService.update(saved.id, input)
        : await adminEngagementService.create(input);
      setSaved(detail);
      return { detail };
    } catch (error) {
      const byField = fieldErrors(error);
      if (Object.keys(byField).length > 0) {
        setErrors(byField);
        return { step: stepOfPath(Object.keys(byField)[0]) };
      }
      throw error;
    } finally {
      setBusy(false);
    }
  }, [check, saved, state]);

  /** Saves, then publishes a draft; a live activity's save is already live. */
  const saveAndPublish = useCallback(async () => {
    const outcome = await save();
    if (!('detail' in outcome) || outcome.detail.status !== 'draft') return outcome;
    setBusy(true);
    try {
      const detail = await adminEngagementService.changeStatus(outcome.detail.id, 'publish');
      setSaved(detail);
      return { detail };
    } finally {
      setBusy(false);
    }
  }, [save]);

  return { state, update, updateDefinition, saved, errors, busy, check, save, saveAndPublish };
}

export type ActivityEditorApi = ReturnType<typeof useActivityEditor>;
