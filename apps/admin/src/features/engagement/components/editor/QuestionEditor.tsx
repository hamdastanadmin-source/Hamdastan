'use client';

import { Copy, Plus, Trash2, X } from 'lucide-react';

import { ENGAGEMENT_LIMITS, QUESTION_KIND_LABELS, QUESTION_KINDS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, AssessmentSettings, ChoiceOption } from '@hamdastan/types';
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@hamdastan/ui';

import { emptyQuestion, newKey } from '../../utils/draft';
import { QUESTION_KIND_UI } from '../../utils/question-kinds';
import { Field, invalid, NEUTRAL_CHECKBOX } from './Field';

type QuestionEditorProps = {
  question: ActivityQuestion;
  number: number;
  /** Where its errors are filed, e.g. `definition.steps.0.questions.2`. */
  path: string;
  errors: Record<string, string>;
  /** The assessment being built, if any: decides the key and scoring fields. */
  assessment: AssessmentSettings | null;
  /** Mission: the step it belongs to, shown above it. */
  stepTitle?: string;
  onChange: (question: ActivityQuestion) => void;
  onDuplicate: (() => void) | null;
  onRemove: (() => void) | null;
};

/**
 * The selected question, in the builder's editing panel — beside the list
 * that orders, duplicates and removes them (Porsline's layout). The kinds are the ones the product's player
 * draws with its existing controls: options as toggle rows, a rating as a
 * row of numbers, a scale as the slider, text as a text area.
 *
 * In a knowledge assessment each option can be marked correct; in a
 * personality assessment each question is tied to a dimension, can be
 * reverse-keyed, and each option carries points.
 */
export function QuestionEditor({
  question,
  number,
  path,
  errors,
  assessment,
  stepTitle,
  onChange,
  onDuplicate,
  onRemove,
}: QuestionEditorProps) {
  const id = `q-${question.id}`;
  const error = (field: string) => errors[`${path}.${field}`];
  const knowledge = assessment?.mode === 'knowledge';
  const personality = assessment?.mode === 'personality';

  const setOptions = (options: ChoiceOption[]) =>
    (question.kind === 'single' || question.kind === 'multiple') && onChange({ ...question, options });

  const KindIcon = QUESTION_KIND_UI[question.kind].icon;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <span className="flex size-9 items-center justify-center rounded-md bg-muted">
          <KindIcon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">سؤال {toPersianDigits(number)}</h3>
          {stepTitle && <span className="text-xs text-muted-foreground">{stepTitle}</span>}
        </div>
        {!question.required && <Badge variant="outline">اختیاری</Badge>}
        <div className="ms-auto flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!onDuplicate}
            onClick={() => onDuplicate?.()}
            aria-label="تکثیر سؤال"
          >
            <Copy aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={!onRemove}
            onClick={() => onRemove?.()}
            aria-label="حذف سؤال"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="نوع سؤال" htmlFor={`${id}-kind`}>
          <Select
            value={question.kind}
            onValueChange={(kind) => onChange(emptyQuestion(kind as ActivityQuestion['kind'], question))}
          >
            <SelectTrigger id={`${id}-kind`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUESTION_KINDS.map((kind) => {
                const Icon = QUESTION_KIND_UI[kind].icon;
                return (
                  <SelectItem key={kind} value={kind}>
                    <Icon aria-hidden="true" />
                    {QUESTION_KIND_LABELS[kind]}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </Field>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Switch
            checked={question.required}
            onCheckedChange={(required) => onChange({ ...question, required })}
            aria-label="الزامی"
          />
          پاسخ الزامی
        </label>
      </div>

        <Field label="متن سؤال" htmlFor={`${id}-title`} error={error('title')}>
          <Input
            id={`${id}-title`}
            value={question.title}
            onChange={(event) => onChange({ ...question, title: event.target.value })}
            {...invalid(error('title'))}
          />
        </Field>
        <Field label="توضیح (اختیاری)" htmlFor={`${id}-description`}>
          <Textarea
            id={`${id}-description`}
            rows={2}
            value={question.description ?? ''}
            onChange={(event) => onChange({ ...question, description: event.target.value || undefined })}
          />
        </Field>

        {(question.kind === 'single' || question.kind === 'multiple') && (
          <Field label="گزینه‌ها" error={error('options')}>
            <ul className="flex flex-col gap-2">
              {question.options.map((option, index) => (
                <li key={option.id} className="flex items-center gap-2">
                  {knowledge && (
                    <Checkbox
                      checked={option.correct ?? false}
                      onCheckedChange={(checked) =>
                        setOptions(
                          question.options.map((o) =>
                            o.id === option.id
                              ? { ...o, correct: checked === true }
                              : question.kind === 'single' && checked === true
                                ? { ...o, correct: false }
                                : o
                          )
                        )
                      }
                      aria-label={`گزینه‌ی ${toPersianDigits(index + 1)} درسته`}
                      className={NEUTRAL_CHECKBOX}
                    />
                  )}
                  <Input
                    value={option.label}
                    placeholder={`گزینه‌ی ${toPersianDigits(index + 1)}`}
                    aria-label={`متن گزینه‌ی ${toPersianDigits(index + 1)}`}
                    onChange={(event) =>
                      setOptions(question.options.map((o) => (o.id === option.id ? { ...o, label: event.target.value } : o)))
                    }
                    {...invalid(error(`options.${index}.label`))}
                  />
                  {personality && (
                    <Input
                      type="number"
                      min={-10}
                      max={10}
                      className="w-20 tabular-nums"
                      value={option.score ?? 0}
                      aria-label={`امتیاز گزینه‌ی ${toPersianDigits(index + 1)}`}
                      onChange={(event) =>
                        setOptions(
                          question.options.map((o) =>
                            o.id === option.id ? { ...o, score: Math.trunc(Number(event.target.value) || 0) } : o
                          )
                        )
                      }
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={question.options.length <= ENGAGEMENT_LIMITS.OPTIONS_MIN}
                    onClick={() => setOptions(question.options.filter((o) => o.id !== option.id))}
                    aria-label={`حذف گزینه‌ی ${toPersianDigits(index + 1)}`}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={question.options.length >= ENGAGEMENT_LIMITS.OPTIONS_MAX}
                onClick={() => setOptions([...question.options, { id: newKey(), label: '' }])}
              >
                <Plus aria-hidden="true" />
                گزینه‌ی جدید
              </Button>
              {knowledge && (
                <p className="text-xs text-muted-foreground">تیک، گزینه‌ی درست رو مشخص می‌کنه.</p>
              )}
              {personality && (
                <p className="text-xs text-muted-foreground">عدد کنار هر گزینه، امتیاز اون گزینه برای بُعدِ این سؤاله.</p>
              )}
            </div>
          </Field>
        )}

        {question.kind === 'multiple' && (
          <Field
            label="سقف انتخاب (اختیاری)"
            htmlFor={`${id}-max`}
            error={error('maxSelections')}
            hint="خالی یعنی بدون محدودیت."
          >
            <Input
              id={`${id}-max`}
              type="number"
              min={1}
              className="w-28 tabular-nums"
              value={question.maxSelections ?? ''}
              onChange={(event) =>
                onChange({ ...question, maxSelections: event.target.value ? Math.max(1, Math.trunc(Number(event.target.value))) : undefined })
              }
              {...invalid(error('maxSelections'))}
            />
          </Field>
        )}

        {question.kind === 'text' && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={question.multiline}
              onCheckedChange={(multiline) => onChange({ ...question, multiline })}
              aria-label="پاسخ چندخطی"
            />
            پاسخ چندخطی (برای توضیح یا مدرک انجام کار)
          </label>
        )}

        {question.kind === 'rating' && (
          <Field label="بازه‌ی امتیاز" htmlFor={`${id}-rating`}>
            <Select value={String(question.max)} onValueChange={(max) => onChange({ ...question, max: Number(max) as 5 | 10 })}>
              <SelectTrigger id={`${id}-rating`} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGAGEMENT_LIMITS.RATING_MAX_CHOICES.map((max) => (
                  <SelectItem key={max} value={String(max)}>
                    ۱ تا {toPersianDigits(max)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {question.kind === 'scale' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ابتدای طیف" htmlFor={`${id}-min`}>
              <Input
                id={`${id}-min`}
                type="number"
                min={ENGAGEMENT_LIMITS.SCALE_MIN_BOUND}
                max={ENGAGEMENT_LIMITS.SCALE_MAX_BOUND}
                value={question.min}
                onChange={(event) => onChange({ ...question, min: Math.trunc(Number(event.target.value) || 0) })}
              />
            </Field>
            <Field label="انتهای طیف" htmlFor={`${id}-maxv`} error={error('max')}>
              <Input
                id={`${id}-maxv`}
                type="number"
                min={ENGAGEMENT_LIMITS.SCALE_MIN_BOUND}
                max={ENGAGEMENT_LIMITS.SCALE_MAX_BOUND}
                value={question.max}
                onChange={(event) => onChange({ ...question, max: Math.trunc(Number(event.target.value) || 0) })}
                {...invalid(error('max'))}
              />
            </Field>
            <Field label="برچسب ابتدا" htmlFor={`${id}-minl`}>
              <Input id={`${id}-minl`} value={question.minLabel} onChange={(event) => onChange({ ...question, minLabel: event.target.value })} />
            </Field>
            <Field label="برچسب انتها" htmlFor={`${id}-maxl`}>
              <Input id={`${id}-maxl`} value={question.maxLabel} onChange={(event) => onChange({ ...question, maxLabel: event.target.value })} />
            </Field>
          </div>
        )}

        {personality && question.kind !== 'text' && (
          <div className="flex flex-wrap items-end gap-4">
            <Field label="بُعدی که می‌سنجه" htmlFor={`${id}-dimension`} error={error('dimensionId')}>
              <Select
                value={question.dimensionId ?? ''}
                onValueChange={(dimensionId) => onChange({ ...question, dimensionId })}
              >
                <SelectTrigger id={`${id}-dimension`} className="w-48" {...invalid(error('dimensionId'))}>
                  <SelectValue placeholder="انتخاب بُعد" />
                </SelectTrigger>
                <SelectContent>
                  {assessment.dimensions.map((dimension) => (
                    <SelectItem key={dimension.id} value={dimension.id}>
                      {dimension.title || 'بُعد بی‌نام'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Switch
                checked={question.reverse ?? false}
                onCheckedChange={(reverse) => onChange({ ...question, reverse })}
                aria-label="سؤال معکوس"
              />
              سؤال معکوس
            </label>
          </div>
        )}
    </div>
  );
}
