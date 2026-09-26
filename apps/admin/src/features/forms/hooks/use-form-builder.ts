'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Form,
  FormPage,
  FormQuestion,
  FormSettings,
  LogicRule,
  QuestionType,
  UpdateFormRequest,
} from '@hamdastan/types';

import { HttpError } from '@/services';

import { formsApi } from '../services/forms.api';
import { createQuestion, newId } from '../types/question-catalogue';

/**
 * The builder's state, and the autosave behind it.
 *
 * The whole document lives here while it is being edited: every change is
 * applied locally first, so the canvas never waits for the network, and a
 * debounced PATCH follows. That is what makes reordering forty questions one
 * request instead of forty.
 *
 * Nothing here decides anything a respondent would notice. Publishing, the
 * audience and every answer rule are the backend's, and this hook only reports
 * what it said.
 */

export type SaveState = 'SAVED' | 'SAVING' | 'UNSAVED' | 'ERROR';

/** Long enough to collapse a burst of typing, short enough to feel automatic. */
const AUTOSAVE_DELAY_MS = 900;

export type FormBuilder = ReturnType<typeof useFormBuilder>;

export function useFormBuilder(initial: Form) {
  const [form, setForm] = useState<Form>(initial);
  const [saveState, setSaveState] = useState<SaveState>('SAVED');
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.questions[0]?.id ?? null
  );

  /** What the next autosave will send. Merged, so a burst becomes one PATCH. */
  const pending = useRef<UpdateFormRequest>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (Object.keys(pending.current).length === 0) return;

    const patch = pending.current;
    pending.current = {};
    setSaveState('SAVING');

    try {
      await formsApi.update(initial.id, patch);
      setSaveState('SAVED');
    } catch (error) {
      // The change is still on screen; what failed is the save. Saying so and
      // leaving the editing alone is better than reverting work.
      setSaveState('ERROR');
      if (!(error instanceof HttpError)) throw error;
    }
  }, [initial.id]);

  /** Applies a change locally and queues it for the next save. */
  const change = useCallback(
    (patch: UpdateFormRequest) => {
      setForm((current) => ({ ...current, ...patch }));
      pending.current = { ...pending.current, ...patch };
      setSaveState('UNSAVED');

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY_MS);
    },
    [flush]
  );

  // A pending save must not be lost because the admin navigated away.
  useEffect(() => () => void flush(), [flush]);

  // ─── Questions ────────────────────────────────────────────────────────────

  /** Renumbers a page's questions so `order` is always contiguous. */
  const renumber = (questions: FormQuestion[]): FormQuestion[] => {
    const byPage = new Map<string, number>();
    return questions.map((question) => {
      const next = byPage.get(question.pageId) ?? 0;
      byPage.set(question.pageId, next + 1);
      return { ...question, order: next };
    });
  };

  const addQuestion = useCallback(
    (type: QuestionType, pageId: string, position?: number) => {
      const pageQuestions = form.questions.filter((question) => question.pageId === pageId);
      const created = createQuestion(type, pageId, position ?? pageQuestions.length);

      const others = form.questions.filter((question) => question.pageId !== pageId);
      const reordered = [...pageQuestions];
      reordered.splice(position ?? reordered.length, 0, created);

      change({ questions: renumber([...others, ...reordered]) });
      setSelectedId(created.id);
      return created.id;
    },
    [change, form.questions]
  );

  const updateQuestion = useCallback(
    (id: string, patch: Partial<FormQuestion>) => {
      change({
        questions: form.questions.map((question) =>
          question.id === id ? { ...question, ...patch } : question
        ),
      });
    },
    [change, form.questions]
  );

  const duplicateQuestion = useCallback(
    (id: string) => {
      const source = form.questions.find((question) => question.id === id);
      if (!source) return;

      const copy: FormQuestion = {
        ...source,
        id: newId(),
        // Options need new ids too, or the two questions' answers could not be
        // told apart later.
        options: source.options?.map((option) => ({ ...option, id: newId() })),
        order: source.order + 1,
      };

      const index = form.questions.findIndex((question) => question.id === id);
      const next = [...form.questions];
      next.splice(index + 1, 0, copy);

      change({ questions: renumber(next) });
      setSelectedId(copy.id);
    },
    [change, form.questions]
  );

  const removeQuestion = useCallback(
    (id: string) => {
      change({
        questions: renumber(form.questions.filter((question) => question.id !== id)),
        // A rule about a question that no longer exists can never fire again,
        // and would show as a broken row in the logic panel.
        conditionalLogic: form.conditionalLogic.filter(
          (rule) => rule.whenQuestionId !== id && rule.targetQuestionId !== id
        ),
      });
      setSelectedId((current) => (current === id ? null : current));
    },
    [change, form.conditionalLogic, form.questions]
  );

  /**
   * Moves a question, possibly onto another page.
   *
   * `position` is the index it should end up at within its (new) page; the rest
   * of the page closes the gap behind it.
   */
  const moveQuestion = useCallback(
    (id: string, pageId: string, position: number) => {
      const moving = form.questions.find((question) => question.id === id);
      if (!moving) return;

      const rest = form.questions.filter((question) => question.id !== id);
      const target = rest
        .filter((question) => question.pageId === pageId)
        .sort((a, b) => a.order - b.order);

      target.splice(Math.max(0, Math.min(position, target.length)), 0, {
        ...moving,
        pageId,
      });

      const others = rest.filter((question) => question.pageId !== pageId);
      change({ questions: renumber([...others, ...target]) });
    },
    [change, form.questions]
  );

  // ─── Pages ────────────────────────────────────────────────────────────────

  const addPage = useCallback(() => {
    const page: FormPage = {
      id: newId(),
      title: `صفحهٔ ${form.pages.length + 1}`,
      order: form.pages.length,
    };
    change({ pages: [...form.pages, page] });
    return page.id;
  }, [change, form.pages]);

  const updatePage = useCallback(
    (id: string, patch: Partial<FormPage>) => {
      change({
        pages: form.pages.map((page) => (page.id === id ? { ...page, ...patch } : page)),
      });
    },
    [change, form.pages]
  );

  const removePage = useCallback(
    (id: string) => {
      // The last page cannot go: a form with no page has nowhere to put a
      // question, and the schema refuses to save one.
      if (form.pages.length <= 1) return;

      const remaining = form.pages
        .filter((page) => page.id !== id)
        .map((page, index) => ({ ...page, order: index }));

      // Its questions move to the page before rather than disappearing with it.
      const fallback = remaining[0].id;
      change({
        pages: remaining,
        questions: renumber(
          form.questions.map((question) =>
            question.pageId === id ? { ...question, pageId: fallback } : question
          )
        ),
      });
    },
    [change, form.pages, form.questions]
  );

  // ─── Logic, settings, the rest ────────────────────────────────────────────

  const setLogic = useCallback(
    (rules: LogicRule[]) => change({ conditionalLogic: rules }),
    [change]
  );

  const setSettings = useCallback(
    (settings: FormSettings) => change({ settings }),
    [change]
  );

  const setMeta = useCallback(
    (patch: Pick<UpdateFormRequest, 'title' | 'description' | 'category' | 'audience'>) =>
      change(patch),
    [change]
  );

  /** Status changes are not autosaved — they are deliberate, and answer at once. */
  const applyStatus = useCallback(async (next: Form) => {
    setForm(next);
    setSaveState('SAVED');
  }, []);

  return {
    form,
    saveState,
    selectedId,
    select: setSelectedId,
    selected: form.questions.find((question) => question.id === selectedId) ?? null,
    addQuestion,
    updateQuestion,
    duplicateQuestion,
    removeQuestion,
    moveQuestion,
    addPage,
    updatePage,
    removePage,
    setLogic,
    setSettings,
    setMeta,
    applyStatus,
    saveNow: flush,
  };
}
