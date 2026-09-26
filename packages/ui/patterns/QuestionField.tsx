'use client';

import * as React from 'react';
import { Star, Upload } from 'lucide-react';

import { API_BASE_URL } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared';
import type { AnswerValue, FormQuestion } from '@hamdastan/types';

import { Badge } from '../primitives/badge';
import { Button } from '../primitives/button';
import { Checkbox } from '../primitives/checkbox';
import { Input } from '../primitives/input';
import { RadioGroupItem } from '../primitives/radio-group';
import { Separator } from '../primitives/separator';
import { Textarea } from '../primitives/textarea';
import { JalaliDateSelect } from './JalaliDateField';
import {
  RadioGroup,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
} from '../components';

/**
 * One question, rendered as the control that answers it.
 *
 * It lives in the design system because two apps need exactly this: the admin
 * panel's preview and the page a respondent actually fills in. Sharing the
 * component is what makes "preview shows what end users see" true by
 * construction rather than by a promise in a document.
 *
 * Controlled, and deliberately dumb: it renders a value and reports a new one.
 * Which questions are shown, which are required and whether an answer is
 * acceptable are all decided elsewhere — by `@hamdastan/shared/forms/logic` and
 * by the backend.
 */

export type QuestionFieldProps = {
  question: FormQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  /** Shown under the control. Comes from the backend or the local check. */
  error?: string;
  /** The builder's canvas renders the control but must not let it be used. */
  disabled?: boolean;
  /** Numbering as the respondent sees it. Omitted for layout blocks. */
  index?: number;
};

const YES = 'بله';
const NO = 'خیر';

/**
 * An uploaded image's URL, as a browser can fetch it.
 *
 * The backend answers with a path (`/api/v1/forms/assets/…`) rather than an
 * absolute URL, because the API's origin is deployment configuration and has no
 * business inside a stored form. It is resolved here instead — which is also
 * why both apps render the same image from the same document.
 */
export function resolveAssetUrl(url: string): string {
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}

export function QuestionField({
  question,
  value,
  onChange,
  error,
  disabled,
  index,
}: QuestionFieldProps) {
  // Layout blocks answer nothing; they are content in the middle of a form.
  if (question.type === 'DIVIDER') return <Separator className="my-2" />;

  if (question.type === 'HEADING') {
    return <h3 className="text-lg font-bold text-foreground">{question.title}</h3>;
  }

  if (question.type === 'DESCRIPTION') {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">{question.title}</p>
    );
  }

  if (question.type === 'IMAGE') {
    return question.settings?.imageUrl ? (
      /* eslint-disable-next-line @next/next/no-img-element -- the design system
         is framework-agnostic and cannot import next/image. */
      <img
        src={resolveAssetUrl(question.settings.imageUrl)}
        alt={question.title}
        className="w-full rounded-lg border border-border object-cover"
      />
    ) : (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        تصویری انتخاب نشده است
      </div>
    );
  }

  const background = question.settings?.backgroundImageUrl;

  return (
    <div
      className={cn('space-y-2', background && 'relative overflow-hidden rounded-lg p-4')}
      style={
        background
          ? {
              // A URL is data, not a design value, so it cannot be a class.
              backgroundImage: `url(${resolveAssetUrl(background)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* A scrim, so the question stays readable over any image. */}
      {background && <div className="absolute inset-0 bg-background/80" aria-hidden />}

      <div className={cn('flex items-start gap-2', background && 'relative')}>
        {index !== undefined && (
          <span className="mt-0.5 text-sm font-medium text-muted-foreground">
            {toPersianDigits(index)}.
          </span>
        )}
        <div className="flex-1 space-y-1">
          <label className="block text-sm font-medium text-foreground">
            {question.title || 'بدون عنوان'}
            {question.required && <span className="text-error ms-1">*</span>}
          </label>
          {question.description && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {question.description}
            </p>
          )}
        </div>
      </div>

      <div className={cn(index !== undefined && 'ps-6', background && 'relative')}>
        <QuestionControl
          question={question}
          value={value}
          onChange={onChange}
          disabled={disabled}
          invalid={Boolean(error)}
        />
        {error && (
          <p className="mt-1.5 text-xs text-error" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function QuestionControl({
  question,
  value,
  onChange,
  disabled,
  invalid,
}: {
  question: FormQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const list = Array.isArray(value) ? value : [];
  const state = invalid ? ('error' as const) : undefined;
  const options = question.options ?? [];

  switch (question.type) {
    case 'LONG_TEXT':
      return (
        <Textarea
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          rows={4}
          maxLength={question.validation?.maxLength}
        />
      );

    case 'NUMBER':
      return (
        <Input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
          placeholder={question.placeholder}
          disabled={disabled}
          state={state}
          min={question.validation?.min}
          max={question.validation?.max}
          // rtl-ok: a number is read left-to-right.
          dir="ltr"
          className="text-start"
        />
      );

    case 'EMAIL':
    case 'URL':
      return (
        <Input
          type={question.type === 'EMAIL' ? 'email' : 'url'}
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          state={state}
          // rtl-ok: an address is Latin text and reads left-to-right.
          dir="ltr"
          className="text-start"
        />
      );

    case 'PHONE':
      return (
        <Input
          type="tel"
          inputMode="numeric"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder ?? '09xxxxxxxxx'}
          disabled={disabled}
          state={state}
          // rtl-ok: a phone number is read left-to-right in every locale.
          dir="ltr"
          className="text-start"
        />
      );

    case 'DATE':
      // Not `<input type="date">`: the browser renders that in its own
      // calendar and its own locale, which for a Persian respondent means
      // being asked for ۲۰ مرداد and offered mm/dd/yyyy. The value handed up
      // is still an ISO Gregorian date.
      return (
        <JalaliDateSelect
          label={question.title || 'تاریخ'}
          value={text}
          onChange={onChange}
          // A date on a form is as likely to be a birth date as a deadline, so
          // the list spans both directions.
          yearsBack={80}
          yearsAhead={10}
          disabled={disabled}
        />
      );

    case 'TIME':
      return (
        <Input
          type="time"
          value={text}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          state={state}
          // rtl-ok: a clock face reads left-to-right in every locale.
          dir="ltr"
          className="text-start"
        />
      );

    case 'YES_NO':
      return (
        <div className="flex gap-2">
          {[YES, NO].map((label) => (
            <Button
              key={label}
              type="button"
              variant={text === label ? 'default' : 'outline'}
              disabled={disabled}
              onClick={() => onChange(text === label ? null : label)}
              className="min-w-24"
            >
              {label}
            </Button>
          ))}
        </div>
      );

    case 'SINGLE_CHOICE':
    case 'IMAGE_CHOICE':
      return (
        <RadioGroup
          value={text}
          onValueChange={onChange}
          disabled={disabled}
          className="space-y-2"
        >
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <RadioGroupItem value={option.label} />
              <span>{option.label}</span>
            </label>
          ))}
          {question.settings?.allowOther && <OtherOption value={text} onChange={onChange} options={options} disabled={disabled} />}
        </RadioGroup>
      );

    case 'MULTIPLE_CHOICE':
      return (
        <div className="space-y-2">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2.5 text-sm transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={list.includes(option.label)}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange(
                    checked
                      ? [...list, option.label]
                      : list.filter((entry) => entry !== option.label)
                  )
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      );

    case 'DROPDOWN':
      return (
        <Select value={text || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger aria-label={question.title}>
            <SelectValue placeholder={question.placeholder ?? 'انتخاب کنید'} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case 'RATING_STARS': {
      const max = question.validation?.scaleMax ?? 5;
      const current = Number(value) || 0;
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: max }, (_, index) => index + 1).map((score) => (
            <button
              key={score}
              type="button"
              disabled={disabled}
              aria-label={`${score}`}
              onClick={() => onChange(current === score ? null : score)}
              className="transition-transform hover:scale-110 disabled:cursor-default"
            >
              <Star
                className={cn(
                  'size-7',
                  score <= current ? 'fill-warning text-warning' : 'text-muted-foreground/40'
                )}
              />
            </button>
          ))}
        </div>
      );
    }

    case 'NUMERIC_SCALE':
    case 'NPS': {
      const max = question.type === 'NPS' ? 10 : question.validation?.scaleMax ?? 10;
      const min = question.type === 'NPS' ? 0 : 1;
      const current = value === null ? null : Number(value);

      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((score) => (
              <button
                key={score}
                type="button"
                disabled={disabled}
                onClick={() => onChange(current === score ? null : score)}
                className={cn(
                  'size-9 rounded-md border text-sm font-medium transition-colors',
                  current === score
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-muted'
                )}
              >
                {toPersianDigits(score)}
              </button>
            ))}
          </div>
          {(question.validation?.minLabel || question.validation?.maxLabel) && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{question.validation?.minLabel}</span>
              <span>{question.validation?.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }

    case 'SLIDER': {
      const min = question.validation?.min ?? 0;
      const max = question.validation?.max ?? 100;
      const current = value === null ? min : Number(value);

      return (
        <div className="space-y-2 pt-1">
          <Slider
            value={[current]}
            min={min}
            max={max}
            step={question.validation?.step ?? 1}
            disabled={disabled}
            onValueChange={([next]) => onChange(next)}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{question.validation?.minLabel ?? toPersianDigits(min)}</span>
            <Badge variant="secondary">{toPersianDigits(current)}</Badge>
            <span>{question.validation?.maxLabel ?? toPersianDigits(max)}</span>
          </div>
        </div>
      );
    }

    case 'RANKING':
      return (
        <div className="space-y-2">
          {(list.length ? list : options.map((option) => option.label)).map((label, position) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5 text-sm"
            >
              <Badge variant="secondary">{toPersianDigits(position + 1)}</Badge>
              <span className="flex-1">{label}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                disabled={disabled || position === 0}
                aria-label="یک پله بالاتر"
                onClick={() => {
                  const current = list.length ? [...list] : options.map((option) => option.label);
                  [current[position - 1], current[position]] = [
                    current[position],
                    current[position - 1],
                  ];
                  onChange(current);
                }}
              >
                ↑
              </Button>
            </div>
          ))}
        </div>
      );

    case 'MATRIX': {
      const rows = question.settings?.rows ?? [];
      const columns = question.settings?.columns ?? [];
      const answers = (value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {}) as Record<string, string>;

      return (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-start font-medium" />
                {columns.map((column) => (
                  <th key={column} className="p-2 text-center font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row} className="border-t border-border">
                  <td className="p-2 font-medium">{row}</td>
                  {columns.map((column) => (
                    <td key={column} className="p-2 text-center">
                      <input
                        type="radio"
                        name={`${question.id}-${row}`}
                        checked={answers[row] === column}
                        disabled={disabled}
                        onChange={() => onChange({ ...answers, [row]: column })}
                        className="size-4 accent-primary"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'FILE_UPLOAD':
      return (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <FilePicker
            disabled={disabled}
            accept={question.validation?.allowedFileTypes?.map((type) => `.${type}`).join(',')}
            filename={text}
            onPick={(name) => onChange(name)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {question.validation?.allowedFileTypes?.length
              ? `فرمت‌های مجاز: ${question.validation.allowedFileTypes.join('، ')}`
              : 'همهٔ فرمت‌ها مجاز است'}
            {question.validation?.maxFileSizeMb
              ? ` — حداکثر ${toPersianDigits(question.validation.maxFileSizeMb)} مگابایت`
              : ''}
          </p>
        </div>
      );

    case 'SIGNATURE':
      return (
        <div className="space-y-2">
          <Input
            value={text}
            onChange={(event) => onChange(event.target.value)}
            placeholder="نام خود را به‌عنوان امضا بنویسید"
            disabled={disabled}
            state={state}
          />
          <p className="text-xs text-muted-foreground">
            امضای دیجیتال با ثبت نام شما معتبر است.
          </p>
        </div>
      );

    default:
      return (
        <Input
          value={text}
          onChange={(event) => onChange(event.target.value)}
          placeholder={question.placeholder}
          disabled={disabled}
          state={state}
          maxLength={question.validation?.maxLength}
        />
      );
  }
}

/**
 * A file chooser that speaks Persian.
 *
 * The native control renders "Choose File / No file chosen" in the browser's
 * own language and ignores `dir`, which is jarring in the middle of a Persian
 * form. The input is still the input — it is simply hidden behind a button.
 */
function FilePicker({
  accept,
  disabled,
  filename,
  onPick,
}: {
  accept?: string;
  disabled?: boolean;
  filename?: string;
  onPick: (name: string | null) => void;
}) {
  const input = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-center gap-2">
      <input
        ref={input}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => onPick(event.target.files?.[0]?.name ?? null)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Upload className="size-4" />
        انتخاب فایل
      </Button>
      <span className="text-xs text-muted-foreground">
        {filename || 'فایلی انتخاب نشده است'}
      </span>
    </div>
  );
}

/** «سایر» — a choice that is whatever the respondent types. */
function OtherOption({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (value: AnswerValue) => void;
  options: { label: string }[];
  disabled?: boolean;
}) {
  const known = options.some((option) => option.label === value);
  const otherValue = known ? '' : value;

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
      <span className="text-sm text-muted-foreground">سایر:</span>
      <Input
        value={otherValue}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="بنویسید…"
        className="h-8"
      />
    </div>
  );
}
