'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, ActivityStep } from '@hamdastan/types';
import { Alert, AlertDescription, Button, Input, Tabs, TabsList, TabsTrigger, Textarea } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { dayTitle, emptyQuestion, emptyStep, isUntouchedStep, limitsFor, newKey } from '../../utils/draft';
import { AssessmentSettingsPanel } from './AssessmentSettingsPanel';
import { Field, invalid } from './Field';
import { ImportQuestionsDialog } from './ImportQuestionsDialog';
import { JourneyDayPanel } from './JourneyDayPanel';
import { JourneyMotionsPanel } from './JourneyMotionsPanel';
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

/** A copy with fresh ids — for the question and each of its options or pairs. */
function copyOf(question: ActivityQuestion): ActivityQuestion {
  const copy = { ...question, id: newKey() };
  if ('options' in copy) return { ...copy, options: copy.options.map((option) => ({ ...option, id: newKey() })) };
  if ('pairs' in copy) return { ...copy, pairs: copy.pairs.map((pair) => ({ ...pair, id: newKey(), matchId: newKey() })) };
  return copy;
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
 *
 * A journey is edited one day at a time: the day tabs choose it, the list
 * shows that day's questions under a row for the day's own settings and
 * cover, and «⋯» on a question can move it to another day.
 */
export function QuestionsStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const { steps, assessment, journey } = state.definition;
  const isJourney = state.type === 'journey';
  const [selected, setSelected] = useState<Selection>(() => ({ kind: 'question', id: steps[0].questions[0].id }));
  const [openDay, setOpenDay] = useState(0);
  const [importing, setImporting] = useState(false);
  const panel = useRef<HTMLElement>(null);

  // A removed or replaced selection falls back to the first question (of the open day, on a journey).
  const day = Math.min(openDay, steps.length - 1);
  const fallbackStep = isJourney ? day : 0;
  // The scoring and the journey's motions are panels of their own, not places in the list.
  const panelOnly = (s: Selection) => s.kind === 'scoring' || s.kind === 'motions';
  const where = panelOnly(selected) ? null : locate(steps, selected);
  const selection: Selection =
    panelOnly(selected) || (where && (!isJourney || where.s === day))
      ? selected
      : { kind: 'question', id: steps[fallbackStep].questions[0].id };
  const at = panelOnly(selection) ? null : (locate(steps, selection) ?? { s: fallbackStep, q: 0 });

  const limits = limitsFor(state.type);
  const total = steps.reduce((sum, step) => sum + step.questions.length, 0);
  const canAddQuestion = total < limits.questions;

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
    // Into the selected question's step, right after it; else at the end of the last step (the open day, on a journey).
    const s = at?.s ?? (isJourney ? day : steps.length - 1);
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
      // A journey question can go to any other day; its own keeps at least one question.
      moveTo:
        isJourney && questions.length > 1
          ? steps.flatMap((target, t) =>
              t === s
                ? []
                : [
                    {
                      label: `${dayTitle(t + 1)}${target.title && target.title !== dayTitle(t + 1) ? ` — ${target.title}` : ''}`,
                      onSelect: () => {
                        const question = questions[q];
                        setSteps(
                          steps.map((step, i) =>
                            i === s
                              ? { ...step, questions: questions.filter((_, j) => j !== q) }
                              : i === t
                                ? { ...step, questions: [...step.questions, question] }
                                : step
                          )
                        );
                        setOpenDay(t);
                        setSelected({ kind: 'question', id: question.id });
                        toast.success(`سؤال به ${dayTitle(t + 1)} منتقل شد`);
                      },
                    },
                  ]
            )
          : undefined,
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

  /** Moves a step, and on a journey keeps the moved day open. */
  const moveStep = (s: number, offset: -1 | 1) => {
    setSteps(moved(steps, s, offset));
    if (isJourney) setOpenDay(s + offset);
  };

  const stepActions = (s: number) => ({
    onMoveUp: s > 0 ? () => moveStep(s, -1) : null,
    onMoveDown: s < steps.length - 1 ? () => moveStep(s, 1) : null,
    // A journey day goes only while nothing is written in it: its questions are moved out first.
    onRemove:
      steps.length > 1 && total - steps[s].questions.length >= 1 && (!isJourney || isUntouchedStep(steps[s]))
        ? () => {
            const next = steps.filter((_, i) => i !== s);
            setSteps(next);
            setOpenDay(Math.max(0, s - 1));
            setSelected({ kind: 'question', id: next[Math.max(0, s - 1)].questions[0].id });
          }
        : null,
  });

  const openDayTab = (value: string) => {
    const index = steps.findIndex((step) => step.id === value);
    setOpenDay(index);
    setSelected({ kind: 'question', id: steps[index].questions[0].id });
  };

  const addStep = () => {
    const step = { ...emptyStep(`مرحله‌ی ${toPersianDigits(steps.length + 1)}`), questions: [emptyQuestion('text')] };
    setSteps([...steps, step]);
    select({ kind: 'step', id: step.id });
  };

  // Numbered through a mission's steps; from 1 on each journey day.
  const stepFlatStart = (s: number) =>
    isJourney ? 0 : steps.slice(0, s).reduce((sum, step) => sum + step.questions.length, 0);
  const hasError = (prefix: string) => Object.keys(errors).some((path) => path.startsWith(prefix));

  return (
    <div className="flex flex-col gap-6">
      {isJourney && (
        <Tabs value={steps[day].id} onValueChange={openDayTab}>
          <TabsList className="w-full justify-start overflow-x-auto" aria-label="روزها">
            {steps.map((step, s) => (
              <TabsTrigger
                key={step.id}
                value={step.id}
                className="shrink-0 gap-1.5 px-3 data-[state=active]:border-foreground data-[state=active]:text-foreground"
              >
                {dayTitle(s + 1)}
                <span className="text-xs font-normal tabular-nums text-muted-foreground">
                  {toPersianDigits(step.questions.length)}/{toPersianDigits(journey?.questionsPerDay ?? 0)}
                </span>
                {hasError(`definition.steps.${s}.`) && (
                  <span className="size-1.5 rounded-full bg-destructive" role="img" aria-label="نیاز به اصلاح" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
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
            canAddStep={steps.length < limits.steps}
            visibleSteps={isJourney ? [day] : undefined}
          />
        </aside>

        <section ref={panel} aria-label="ویرایش" className="flex min-w-0 scroll-mt-20 flex-col gap-6">
          {errors['definition.steps'] && (
            <Alert variant="destructive">
              <AlertDescription>{errors['definition.steps']}</AlertDescription>
            </Alert>
          )}

          {selection.kind === 'scoring' && assessment && (
            <AssessmentSettingsPanel
              settings={assessment}
              errors={errors}
              questions={steps.flatMap((step) => step.questions)}
              competition={state.type === 'competition'}
              onChange={(next) => updateDefinition({ assessment: next })}
            />
          )}

          {selection.kind === 'motions' && journey && (
          <JourneyMotionsPanel
            motions={journey.motions}
            errors={errors}
            onChange={(motions) => updateDefinition({ journey: { ...journey, motions } })}
          />
        )}

        {selection.kind === 'step' && at && isJourney && (
            <JourneyDayPanel
              key={steps[at.s].id}
              day={steps[at.s]}
              number={at.s + 1}
              path={`definition.steps.${at.s}`}
              errors={errors}
              onChange={(next) => setStep(at.s, next)}
              onRemove={stepActions(at.s).onRemove}
            />
          )}

          {selection.kind === 'step' && at && !isJourney && (
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
              <Field label="توضیح مرحله (اختیاری)" htmlFor="step-description" hint="در اپلیکیشن، بالای اولین سؤالِ این مرحله نمایش داده می‌شود.">
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
                stepTitle={state.type === 'mission' || isJourney ? steps[at.s].title : undefined}
                journey={isJourney}
                traits={journey?.result?.enabled ? journey.result.traits : undefined}
                onChange={(next) => setQuestions(at.s, steps[at.s].questions.map((q, i) => (i === at.q ? next : q)))}
                onDuplicate={questionActions(at.s, at.q).onDuplicate}
                onRemove={questionActions(at.s, at.q).onRemove}
              />
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-muted-foreground">پیش‌نمایش در اپلیکیشن</p>
                <div className="w-full max-w-shell rounded-xl border bg-surface-0 p-5">
                  <PreviewQuestion question={steps[at.s].questions[at.q]} number={stepFlatStart(at.s) + at.q + 1} />
                </div>
              </div>
            </>
          )}
        </section>

      </div>

      <ImportQuestionsDialog
        open={importing}
        onOpenChange={setImporting}
        type={state.type}
        definition={state.definition}
        targetStep={isJourney ? day : undefined}
        onImport={(definition, added) => {
          updateDefinition(definition);
          toast.success(`${toPersianDigits(added)} سؤال از اکسل اضافه شد`);
        }}
      />
    </div>
  );
}
