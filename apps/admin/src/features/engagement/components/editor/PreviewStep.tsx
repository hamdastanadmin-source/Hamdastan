'use client';

import { Check, Clock } from 'lucide-react';

import { ACTIVITY_TYPE_LABELS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Separator,
  Slider,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { formatDateTime } from '@/lib';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { toInput } from '../../utils/draft';
import { describeAudience } from '../../utils/labels';

const OPTION =
  'group/option h-auto min-h-12 w-full justify-start gap-3 whitespace-normal rounded-xl border px-4 py-3 text-start font-normal data-[state=on]:border-foreground';

/** A question as the player draws it, inert. */
export function PreviewQuestion({ question, number }: { question: ActivityQuestion; number: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">سؤال {toPersianDigits(number)}</p>
      <p className="text-lg font-semibold leading-relaxed">
        {question.title || 'متن سؤال'}
        {!question.required && <span className="ms-2 text-xs font-normal text-muted-foreground">(اختیاری)</span>}
      </p>
      {question.description && <p className="text-sm text-muted-foreground">{question.description}</p>}

      {(question.kind === 'single' || question.kind === 'multiple') && (
        <ToggleGroup type="multiple" spacing={2} className="w-full flex-col items-stretch" aria-label="گزینه‌ها">
          {question.options.map((option) => (
            <ToggleGroupItem key={option.id} value={option.id} className={OPTION}>
              <span className="flex-1">{option.label || 'گزینه'}</span>
              <Check aria-hidden="true" className="invisible size-4 group-data-[state=on]/option:visible" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {question.kind === 'text' && <Textarea rows={question.multiline ? 4 : 1} placeholder="جوابت رو بنویس" />}
      {question.kind === 'rating' && (
        <ToggleGroup type="single" spacing={1} className="w-full flex-wrap" aria-label="امتیاز">
          {Array.from({ length: question.max }, (_, i) => (
            <ToggleGroupItem key={i} value={String(i + 1)} className="size-10 rounded-lg border data-[state=on]:border-foreground">
              {toPersianDigits(i + 1)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {question.kind === 'scale' && (
        <div className="flex flex-col gap-3 pt-2">
          <Slider
            min={question.min}
            max={question.max}
            step={1}
            defaultValue={[question.min]}
            // As the player draws it: neutral, the violet is the primary action's.
            trackClassName="bg-foreground/10"
            rangeClassName="bg-foreground/35"
            thumbClassName="border-foreground/40"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{question.minLabel}</span>
            <span>{question.maxLabel}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Step 7: the activity as the product will show it — the card, then each
 * question in the product's 430px column — beside a summary of who gets it, when, and
 * for how much. Publishing is the footer's primary action.
 */
export function PreviewStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, errors } = editor;
  const { definition } = state;
  const input = toInput(state);
  const questions = definition.steps.flatMap((step) => step.questions.map((question) => ({ step, question })));
  const problems = Object.values(errors);

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div
        className="mx-auto w-full max-w-shell shrink-0 overflow-hidden rounded-3xl border-8 border-foreground/80 bg-background shadow-lg"
        aria-label="پیش‌نمایش موبایل"
      >
        <div className="flex max-h-180 flex-col gap-6 overflow-y-auto p-5">
          <article className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
            <Badge variant="outline" className="w-fit">
              {ACTIVITY_TYPE_LABELS[state.type]}
            </Badge>
            <h2 className="text-base font-bold leading-snug">{state.title || 'عنوان فعالیت'}</h2>
            {state.summary && <p className="text-sm leading-relaxed text-muted-foreground">{state.summary}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" className="size-3.5" />
                حدود {toPersianDigits(definition.estimatedMinutes)} دقیقه
              </span>
              {definition.xp.enabled && definition.xp.showBeforeStart && definition.xp.amount > 0 && (
                <bdi dir="ltr" className="rounded-full border px-2 py-0.5 tabular-nums">
                  +{toPersianDigits(definition.xp.amount)} XP
                </bdi>
              )}
            </div>
            <Button size="lg" className="w-full">
              شروع
            </Button>
          </article>

          {state.instructions && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{state.instructions}</p>
          )}

          {questions.map(({ step, question }, index) => (
            <div key={question.id} className="flex flex-col gap-3">
              <Separator />
              {state.type === 'mission' && step.questions[0]?.id === question.id && (
                <p className="text-sm font-semibold">{step.title}</p>
              )}
              <PreviewQuestion question={question} number={index + 1} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        <dl className="grid gap-3 text-sm">
          {[
            ['نوع', ACTIVITY_TYPE_LABELS[state.type]],
            ['مخاطبان', describeAudience(state.audience)],
            ['سؤال‌ها', toPersianDigits(questions.length)],
            ['XP', definition.xp.enabled ? toPersianDigits(definition.xp.amount) : 'ندارد'],
            ['شروع', input.startsAt ? formatDateTime(input.startsAt) : 'از لحظه‌ی انتشار'],
            ['پایان', input.endsAt ? formatDateTime(input.endsAt) : 'بدون پایان'],
            ...(definition.anonymous ? [['حریم خصوصی', 'پاسخ‌ها ناشناس']] : []),
          ].map(([term, value]) => (
            <div key={term} className="flex justify-between gap-4 border-b pb-2">
              <dt className="text-muted-foreground">{term}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>قبل از انتشار این‌ها رو درست کن</AlertTitle>
            <AlertDescription>
              <ul className="list-disc ps-4">
                {problems.slice(0, 6).map((problem, index) => (
                  <li key={index}>{problem}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
