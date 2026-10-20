'use client';

import { useCallback, useMemo, useState } from 'react';

import type { AdminEventDetail, EventStatusInput } from '@hamdastan/types';
import { eventInputSchema, eventPublishProblems } from '@hamdastan/validation';

import { fieldErrors } from '@/lib';
import { adminEventsService } from '@/services';

import { emptyState, fromDetail, sectionOfPath, toInput, type EditorSectionId, type EditorState } from '../utils/draft';

/**
 * The event editor's state: the working copy, the errors under each field,
 * what still stands between it and publishing, and saving. A save is checked
 * with the schema the API parses with, so a problem lands under its field —
 * and opens its section — before the request is sent; what only the server
 * can know comes back the same way.
 *
 * A new event is created on its first save; from then on saves update it.
 */
/** `worldId`: a new event opened from a world's page starts filed under it. */
export function useEventEditor(initial?: AdminEventDetail, worldId?: string) {
  const [state, setState] = useState<EditorState>(() =>
    initial ? fromDetail(initial) : { ...emptyState(), worldIds: worldId ? [worldId] : [] }
  );
  const [saved, setSaved] = useState<AdminEventDetail | null>(initial ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const update = useCallback((patch: Partial<EditorState>) => setState((current) => ({ ...current, ...patch })), []);

  /** The publish checklist — the same rule the API applies. */
  const problems = useMemo(() => eventPublishProblems(toInput(state)), [state]);

  /** Files errors by path and answers the section of the first one. */
  const fail = useCallback((byPath: Record<string, string>): { section: EditorSectionId } => {
    setErrors(byPath);
    return { section: sectionOfPath(Object.keys(byPath)[0]) };
  }, []);

  const save = useCallback(async (): Promise<{ detail: AdminEventDetail } | { section: EditorSectionId }> => {
    const result = eventInputSchema.safeParse(toInput(state));
    if (!result.success) {
      const byPath: Record<string, string> = {};
      for (const issue of result.error.issues) byPath[issue.path.join('.')] ??= issue.message;
      return fail(byPath);
    }
    setErrors({});
    setBusy(true);
    try {
      const input = toInput(state);
      const detail = saved ? await adminEventsService.update(saved.id, input) : await adminEventsService.create(input);
      setSaved(detail);
      // The server may have filled the slug, or given tickets their ids.
      setState(fromDetail(detail));
      return { detail };
    } catch (error) {
      const byField = fieldErrors(error);
      if (Object.keys(byField).length > 0) return fail(byField);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [fail, saved, state]);

  /** Saves, then moves the status; a problem that blocks it is filed like any other. */
  const changeStatus = useCallback(
    async (input: EventStatusInput): Promise<{ detail: AdminEventDetail } | { section: EditorSectionId }> => {
      const outcome = await save();
      if (!('detail' in outcome)) return outcome;
      setBusy(true);
      try {
        const detail = await adminEventsService.changeStatus(outcome.detail.id, input);
        setSaved(detail);
        return { detail };
      } catch (error) {
        const byField = fieldErrors(error);
        if (Object.keys(byField).length > 0) return fail(byField);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [fail, save]
  );

  return { state, update, saved, errors, busy, problems, save, changeStatus };
}

export type EventEditorApi = ReturnType<typeof useEventEditor>;
