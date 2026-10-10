'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, ActivityStep } from '@hamdastan/types';
import { Alert, AlertDescription, Button, Input, Textarea } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { emptyQuestion, emptyStep, newKey } from '../../utils/draft';
import { AssessmentSettingsPanel } from './AssessmentSettingsPanel';
import { Field, invalid } from './Field';
import { ImportQuestionsDialog } from './ImportQuestionsDialog';
import { PreviewQuestion } from './PreviewStep';
import { QuestionEditor } from './QuestionEditor';
import { QuestionOutline, type Selection } from './QuestionOutline';

/** Moves `items[index]` by `offset`, if it stays inside the list. */
function moved<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** A copy with fresh ids — for the question and each of its options. */
function copyOf(question: ActivityQuestion): ActivityQuestion {
  const copy = { ...question, id: newKey() };
  return 'options' in copy ? { ...copy, options: copy.options.map((option) => ({ ...option, id: newKey() })) } : copy;
}

/** Where a selection sits: its step, and its question if it is one. */
function locate(steps: ActivityStep[], selection: Selection) {
  for (const [s, step] of steps.entries()) {
    if (selection.kind === 'step' && step.id === selection.id) return { s, q: -1 };
    if (selection.kind === 'question') {
      const q = step.questions.findIndex((question) => question.id === selection.id);
      if (q !== -1) return { s, q };
    }
  }
  return null;
}

/**
 * Step 3, laid out like Porsline: the list of questions on the reading-start
 * side, and the one being edited beside it with its preview. A new question
 * is single-choice until its «نوع سؤال» says otherwise; a mission's steps group the list; an
 * assessment's scoring opens from the top of it. «ورود از اکسل» adds rows
 * from a spreadsheet after the questions already there.
 */
export function QuestionsStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const { steps, assessment } = state.definition;
  const [selected, setSelected] = useState<Selection>(() => ({ kind: 'question', id: steps[0].questions[0].id }));
  const [importing, setImporting] = useState(false);
  const panel = useRef<HTMLElement>(null);

  // A removed or replaced selection falls back to the first question.
  const where = selected.kind === 'scoring' ? null : locate(steps, selected);
  const selection: Selection =
    selected.kind === 'scoring' || where ? selected : { kind: 'question', id: steps[0].questions[0].id };
  const at = selection.kind === 'scoring' ? null : (where ?? { s: 0, q: 0 });

  const total = steps.reduce((sum, step) => sum + step.questions.length, 0);
  const canAddQuestion = total < ENGAGEMENT_LIMITS.QUESTIONS_MAX;

  const setSteps = (next: ActivityStep[]) => updateDefinition({ steps: next });
  const setStep = (s: number, step: ActivityStep) => setSteps(steps.map((x, i) => (i === s ? step : x)));
  const setQuestions = (s: number, questions: ActivityQuestion[]) => setStep(s, { ...steps[s], questions });

  /** Opens an item; on a narrow screen the panel is below the list, so bring it into view. */
  const select = (next: Selection) => {
    setSelected(next);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  };

  /** A single-choice question, right after the selected one; its kind is changed in the editor. */
  const addQuestion = () => {
    // Into the selected question's step, right after it; else at the end of the last step.
    const s = at?.s ?? steps.length - 1;
    const after = at && at.q >= 0 ? at.q + 1 : steps[s].questions.length;
    const question = emptyQuestion('single');
    const questions = [...steps[s].questions];
    questions.splice(after, 0, question);
    setQuestions(s, questions);
    select({ kind: 'question', id: question.id });
  };

  const questionActions = (s: number, q: number) => {
    const questions = steps[s].questions;
    return {
      onMoveUp: q > 0 ? () => setQuestions(s, moved(questions, q, -1)) : null,
      onMoveDown: q < questions.length - 1 ? () => setQuestions(s, moved(questions, q, 1)) : null,
      onDuplicate: canAddQuestion
        ? () => {
            const copy = copyOf(questions[q]);
            setQuestions(s, [...questions.slice(0, q + 1), copy, ...questions.slice(q + 1)]);
            select({ kind: 'question', id: copy.id });
          }
        : null,
      // A step keeps at least one question.
      onRemove:
        questions.length > 1
          ? () => {
              const neighbour = questions[q + 1] ?? questions[q - 1];
              setQuestions(s, questions.filter((_, i) => i !== q));
              setSelected({ kind: 'question', id: neighbour.id });
            }
          : null,
    };
  };

  const stepActions = (s: number) => ({
    onMoveUp: s > 0 ? () => setSteps(moved(steps, s, -1)) : null,
    onMoveDown: s < steps.length - 1 ? () => setSteps(moved(steps, s, 1)) : null,
    onRemove:
      steps.length > 1 && total - steps[s].questions.length >= 1
        ? () => {
            const next = steps.filter((_, i) => i !== s);
            setSteps(next);
            setSelected({ kind: 'question', id: next[Math.max(0, s - 1)].questions[0].id });
          }
        : null,
  });

  const addStep = () => {
    const step = { ...emptyStep(`مرحله‌ی ${toPersianDigits(steps.length + 1)}`), questions: [emptyQuestion('text')] };
    setSteps([...steps, step]);
    select({ kind: 'step', id: step.id });
  };

  const stepFlatStart = (s: number) => steps.slice(0, s).reduce((sum, step) => sum + step.questions.length, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(15rem,18rem)_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start lg:border-e lg:pe-6">
        <QuestionOutline
          type={state.type}
          steps={steps}
          selection={selection}
          errors={errors}
          onSelect={select}
          questionActions={questionActions}
          stepActions={stepActions}
          onAddQuestion={addQuestion}
          onAddStep={addStep}
          onImport={() => setImporting(true)}
          canAddQuestion={canAddQuestion}
          canAddStep={steps.length < ENGAGEMENT_LIMITS.STEPS_MAX}
        />
      </aside>

      <section ref={panel} aria-label="ویرایش" className="flex min-w-0 scroll-mt-20 flex-col gap-6">
        {errors['definition.steps'] && (
          <Alert variant="destructive">
            <AlertDescription>{errors['definition.steps']}</AlertDescription>
          </Alert>
        )}

        {selection.kind === 'scoring' && assessment && (
          <AssessmentSettingsPanel settings={assessment} errors={errors} onChange={(next) => updateDefinition({ assessment: next })} />
        )}

        {selection.kind === 'step' && at && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b pb-4">
              <h3 className="text-base font-semibold">مرحله‌ی {toPersianDigits(at.s + 1)}</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                className="ms-auto text-muted-foreground hover:text-destructive"
                disabled={!stepActions(at.s).onRemove}
                onClick={() => stepActions(at.s).onRemove?.()}
                aria-label="حذف مرحله"
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            <Field label="عنوان مرحله" htmlFor="step-title" error={errors[`definition.steps.${at.s}.title`]}>
              <Input
                id="step-title"
                value={steps[at.s].title}
                onChange={(event) => setStep(at.s, { ...steps[at.s], title: event.target.value })}
                {...invalid(errors[`definition.steps.${at.s}.title`])}
              />
            </Field>
            <Field label="توضیح مرحله (اختیاری)" htmlFor="step-description" hint="بالای اولین سؤالِ این مرحله توی اپ نشون داده می‌شه.">
              <Textarea
                id="step-description"
                rows={3}
                value={steps[at.s].description}
                onChange={(event) => setStep(at.s, { ...steps[at.s], description: event.target.value })}
              />
            </Field>
          </div>
        )}

        {selection.kind === 'question' && at && at.q >= 0 && (
          <>
            <QuestionEditor
              key={steps[at.s].questions[at.q].id}
              question={steps[at.s].questions[at.q]}
              number={stepFlatStart(at.s) + at.q + 1}
              path={`definition.steps.${at.s}.questions.${at.q}`}
              errors={errors}
              assessment={assessment}
              stepTitle={state.type === 'mission' ? steps[at.s].title : undefined}
              onChange={(next) => setQuestions(at.s, steps[at.s].questions.map((q, i) => (i === at.q ? next : q)))}
              onDuplicate={questionActions(at.s, at.q).onDuplicate}
              onRemove={questionActions(at.s, at.q).onRemove}
            />
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-muted-foreground">پیش‌نمایش در اپ</p>
              <div className="w-full max-w-shell rounded-xl border bg-surface-0 p-5">
                <PreviewQuestion question={steps[at.s].questions[at.q]} number={stepFlatStart(at.s) + at.q + 1} />
              </div>
            </div>
          </>
        )}
      </section>

      <ImportQuestionsDialog
        open={importing}
        onOpenChange={setImporting}
        type={state.type}
        definition={state.definition}
        onImport={(definition, added) => {
          updateDefinition(definition);
          toast.success(`${toPersianDigits(added)} سؤال از اکسل اضافه شد`);
        }}
      />
    </div>
  );
}
