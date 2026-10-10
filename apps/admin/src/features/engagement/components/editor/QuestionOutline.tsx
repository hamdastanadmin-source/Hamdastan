'use client';

import { ArrowDown, ArrowUp, Calculator, Copy, FileSpreadsheet, Flag, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { QUESTION_KIND_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityStep, ActivityType } from '@hamdastan/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hamdastan/ui';

import { QUESTION_KIND_UI } from '../../utils/question-kinds';

/** What the editing panel shows. */
export type Selection = { kind: 'question'; id: string } | { kind: 'step'; id: string } | { kind: 'scoring' };

/** The actions a row's «⋯» offers; null leaves one out. */
type RowActions = {
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onDuplicate?: (() => void) | null;
  onRemove: (() => void) | null;
};

/** A selected row is a neutral surface and weight — never the brand colour. */
const ROW =
  'flex min-h-10 w-full min-w-0 items-center gap-3 rounded-md px-2 py-2 text-start text-sm outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:bg-accent data-[active=true]:font-semibold';

function RowMenu({ label, actions }: { label: string; actions: RowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" aria-label={`گزینه‌های ${label}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem disabled={!actions.onMoveUp} onSelect={() => actions.onMoveUp?.()}>
          <ArrowUp aria-hidden="true" />
          بالاتر
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!actions.onMoveDown} onSelect={() => actions.onMoveDown?.()}>
          <ArrowDown aria-hidden="true" />
          پایین‌تر
        </DropdownMenuItem>
        {actions.onDuplicate !== undefined && (
          <DropdownMenuItem disabled={!actions.onDuplicate} onSelect={() => actions.onDuplicate?.()}>
            <Copy aria-hidden="true" />
            تکثیر
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={!actions.onRemove} onSelect={() => actions.onRemove?.()}>
          <Trash2 aria-hidden="true" />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The builder's question list (Porsline's left — here right — rail): every
 * question numbered, with its kind's icon, its text or a muted placeholder,
 * and a dot when it has something to fix. A mission groups them under its
 * steps; an assessment opens with its scoring. Choosing a row opens it in
 * the editing panel; «⋯» moves, duplicates or removes it.
 */
export function QuestionOutline({
  type,
  steps,
  selection,
  errors,
  onSelect,
  questionActions,
  stepActions,
  onAddQuestion,
  onAddStep,
  onImport,
  canAddQuestion,
  canAddStep,
}: {
  type: ActivityType;
  steps: ActivityStep[];
  selection: Selection;
  errors: Record<string, string>;
  onSelect: (selection: Selection) => void;
  questionActions: (stepIndex: number, questionIndex: number) => RowActions;
  stepActions: (stepIndex: number) => RowActions;
  onAddQuestion: () => void;
  onAddStep: () => void;
  onImport: () => void;
  canAddQuestion: boolean;
  canAddStep: boolean;
}) {
  const mission = type === 'mission';
  const hasError = (prefix: string) => Object.keys(errors).some((path) => path.startsWith(prefix));
  // Questions are numbered straight through, across a mission's steps.
  const firstNumber = steps.map((_, s) => steps.slice(0, s).reduce((sum, step) => sum + step.questions.length, 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="سؤال‌ها">
        <ul className="flex flex-col gap-0.5">
          {type === 'assessment' && (
            <li className="mb-2 border-b pb-2">
              <button
                type="button"
                className={ROW}
                data-active={selection.kind === 'scoring'}
                onClick={() => onSelect({ kind: 'scoring' })}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted">
                  <Calculator aria-hidden="true" className="size-3.5" />
                </span>
                <span className="flex-1 truncate">روش محاسبه‌ی نتیجه</span>
                {hasError('definition.assessment') && <ErrorDot />}
              </button>
            </li>
          )}

          {steps.map((step, s) => (
            <li key={step.id} className={cn(mission && s > 0 && 'mt-2 border-t pt-2')}>
              {mission && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={cn(ROW, 'text-muted-foreground data-[active=true]:text-foreground')}
                    data-active={selection.kind === 'step' && selection.id === step.id}
                    onClick={() => onSelect({ kind: 'step', id: step.id })}
                  >
                    <Flag aria-hidden="true" className="size-4 shrink-0" />
                    <span className="flex-1 truncate">
                      مرحله‌ی {toPersianDigits(s + 1)}
                      {step.title && `: ${step.title}`}
                    </span>
                    {hasError(`definition.steps.${s}.title`) && <ErrorDot />}
                  </button>
                  <RowMenu label={`مرحله‌ی ${toPersianDigits(s + 1)}`} actions={stepActions(s)} />
                </div>
              )}
              <ul className={cn('flex flex-col gap-0.5', mission && 'ps-3')}>
                {step.questions.map((question, q) => {
                  const number = firstNumber[s] + q;
                  const Icon = QUESTION_KIND_UI[question.kind].icon;
                  const active = selection.kind === 'question' && selection.id === question.id;
                  return (
                    <li key={question.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        className={ROW}
                        data-active={active}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => onSelect({ kind: 'question', id: question.id })}
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs tabular-nums">
                          {toPersianDigits(number)}
                        </span>
                        <Icon aria-label={QUESTION_KIND_LABELS[question.kind]} className="size-4 shrink-0 text-muted-foreground" />
                        <span className={cn('flex-1 truncate', !question.title && 'font-normal text-muted-foreground')}>
                          {question.title || 'سؤال بدون متن'}
                        </span>
                        {hasError(`definition.steps.${s}.questions.${q}.`) && <ErrorDot />}
                      </button>
                      <RowMenu label={`سؤال ${toPersianDigits(number)}`} actions={questionActions(s, q)} />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-2">
        {/* The kind is chosen in the editor's «نوع سؤال», so adding asks nothing first. */}
        <Button variant="outline" className="w-full" onClick={onAddQuestion} disabled={!canAddQuestion}>
          <Plus aria-hidden="true" />
          افزودن سؤال
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <Button variant="ghost" onClick={onImport} disabled={!canAddQuestion}>
            <FileSpreadsheet aria-hidden="true" />
            ورود از اکسل
          </Button>
          {mission && (
            <Button variant="ghost" onClick={onAddStep} disabled={!canAddStep}>
              <Flag aria-hidden="true" />
              مرحله‌ی جدید
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorDot() {
  return <span className="size-2 shrink-0 rounded-full bg-destructive" role="img" aria-label="نیاز به اصلاح" />;
}
