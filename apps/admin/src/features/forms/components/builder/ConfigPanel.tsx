'use client';

import { GripVertical, MousePointerClick, Plus, Trash2 } from 'lucide-react';

import type { FormOption, FormQuestion } from '@hamdastan/types';
import {
  Button,
  FormField,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  Textarea,
} from '@hamdastan/ui';

import type { FormBuilder } from '../../hooks/use-form-builder';
import { newId, paletteItem } from '../../types/question-catalogue';
import { BackgroundField } from './BackgroundField';

/**
 * The selected question's settings, on the left.
 *
 * What it shows depends on the question: a choice question gets its options, a
 * text question its lengths, a file upload its formats. Everything writes
 * straight through the builder, which applies it locally and autosaves — so a
 * setting takes effect on the canvas as it is typed.
 *
 * It is a panel of controls and nothing more: no rule here decides whether an
 * answer is acceptable. That is `apps/api`'s, against the same values.
 */
export function ConfigPanel({ builder }: { builder: FormBuilder }) {
  const question = builder.selected;

  if (!question) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MousePointerClick className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">
          یک پرسش را انتخاب کنید تا تنظیماتش اینجا نمایش داده شود.
        </p>
      </div>
    );
  }

  const set = (patch: Partial<FormQuestion>) => builder.updateQuestion(question.id, patch);
  const setValidation = (patch: Partial<NonNullable<FormQuestion['validation']>>) =>
    set({ validation: { ...question.validation, ...patch } });
  const setSettings = (patch: Partial<NonNullable<FormQuestion['settings']>>) =>
    set({ settings: { ...question.settings, ...patch } });

  const item = paletteItem(question.type);
  const isLayout = ['HEADING', 'DESCRIPTION', 'DIVIDER', 'IMAGE'].includes(question.type);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <item.icon className="size-4 text-primary" />
          <span className="text-sm font-semibold">{item.label}</span>
        </div>

        <Separator />

        <FormField label={isLayout ? 'متن' : 'عنوان پرسش'} required>
          <Textarea
            value={question.title}
            onChange={(event) => set({ title: event.target.value })}
            rows={2}
            placeholder="پرسش خود را بنویسید"
          />
        </FormField>

        {!isLayout && (
          <>
            <FormField label="توضیح (اختیاری)">
              <Textarea
                value={question.description ?? ''}
                onChange={(event) => set({ description: event.target.value })}
                rows={2}
                placeholder="راهنمای کوتاه برای پاسخ‌دهنده"
              />
            </FormField>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <label htmlFor="required" className="text-sm">
                پاسخ الزامی است
              </label>
              <Switch
                id="required"
                checked={question.required}
                onCheckedChange={(checked) => set({ required: checked })}
              />
            </div>
          </>
        )}

        {SUPPORTS_PLACEHOLDER.has(question.type) && (
          <FormField label="متن راهنما">
            <Input
              value={question.placeholder ?? ''}
              onChange={(event) => set({ placeholder: event.target.value })}
              placeholder="مثلاً: پاسخ خود را بنویسید…"
            />
          </FormField>
        )}

        {SUPPORTS_DEFAULT.has(question.type) && (
          <FormField label="مقدار پیش‌فرض">
            <Input
              value={question.defaultValue ?? ''}
              onChange={(event) => set({ defaultValue: event.target.value })}
            />
          </FormField>
        )}

        {/* ── Choice ─────────────────────────────────────────────────────── */}
        {HAS_OPTIONS.has(question.type) && (
          <OptionEditor
            options={question.options ?? []}
            onChange={(options) => set({ options })}
          />
        )}

        {HAS_OPTIONS.has(question.type) && question.type !== 'RANKING' && (
          <div className="space-y-2">
            <ToggleRow
              id="allowOther"
              label="گزینهٔ «سایر» با متن آزاد"
              checked={question.settings?.allowOther ?? false}
              onChange={(checked) => setSettings({ allowOther: checked })}
            />
            <ToggleRow
              id="randomize"
              label="نمایش تصادفی گزینه‌ها"
              checked={question.settings?.randomize ?? false}
              onChange={(checked) => setSettings({ randomize: checked })}
            />
          </div>
        )}

        {question.type === 'MULTIPLE_CHOICE' && (
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="حداقل انتخاب"
              value={question.validation?.minSelections}
              onChange={(value) => setValidation({ minSelections: value })}
            />
            <NumberField
              label="حداکثر انتخاب"
              value={question.validation?.maxSelections}
              onChange={(value) => setValidation({ maxSelections: value })}
            />
          </div>
        )}

        {/* ── Text ───────────────────────────────────────────────────────── */}
        {['SHORT_TEXT', 'LONG_TEXT'].includes(question.type) && (
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="حداقل نویسه"
              value={question.validation?.minLength}
              onChange={(value) => setValidation({ minLength: value })}
            />
            <NumberField
              label="حداکثر نویسه"
              value={question.validation?.maxLength}
              onChange={(value) => setValidation({ maxLength: value })}
            />
          </div>
        )}

        {/* ── Number and slider ──────────────────────────────────────────── */}
        {['NUMBER', 'SLIDER'].includes(question.type) && (
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="کمینه"
              value={question.validation?.min}
              onChange={(value) => setValidation({ min: value })}
            />
            <NumberField
              label="بیشینه"
              value={question.validation?.max}
              onChange={(value) => setValidation({ max: value })}
            />
          </div>
        )}

        {/* ── Rating scales ──────────────────────────────────────────────── */}
        {['RATING_STARS', 'NUMERIC_SCALE'].includes(question.type) && (
          <FormField label="بیشینهٔ طیف">
            <Select
              value={String(question.validation?.scaleMax ?? (question.type === 'RATING_STARS' ? 5 : 10))}
              onValueChange={(value) => setValidation({ scaleMax: Number(value) })}
            >
              <SelectTrigger aria-label="بیشینهٔ طیف">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(question.type === 'RATING_STARS' ? [3, 4, 5, 7, 10] : [3, 5, 7, 10]).map(
                  (value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {SUPPORTS_LABELS.has(question.type) && (
          <div className="grid grid-cols-2 gap-2">
            <FormField label="برچسب ابتدا">
              <Input
                value={question.validation?.minLabel ?? ''}
                onChange={(event) => setValidation({ minLabel: event.target.value })}
              />
            </FormField>
            <FormField label="برچسب انتها">
              <Input
                value={question.validation?.maxLabel ?? ''}
                onChange={(event) => setValidation({ maxLabel: event.target.value })}
              />
            </FormField>
          </div>
        )}

        {/* ── File upload ────────────────────────────────────────────────── */}
        {question.type === 'FILE_UPLOAD' && (
          <>
            <FormField
              label="فرمت‌های مجاز"
              helperText="با ویرگول جدا کنید، مثلاً pdf, jpg, png"
            >
              <Input
                value={(question.validation?.allowedFileTypes ?? []).join('، ')}
                onChange={(event) =>
                  setValidation({
                    allowedFileTypes: event.target.value
                      .split(/[,،]/)
                      .map((entry) => entry.trim().replace(/^\./, ''))
                      .filter(Boolean),
                  })
                }
                // rtl-ok: file extensions are Latin and read left-to-right.
                dir="ltr"
                className="text-start"
              />
            </FormField>
            <NumberField
              label="حداکثر حجم (مگابایت)"
              value={question.validation?.maxFileSizeMb}
              onChange={(value) => setValidation({ maxFileSizeMb: value })}
            />
          </>
        )}

        {/* ── Matrix ─────────────────────────────────────────────────────── */}
        {question.type === 'MATRIX' && (
          <>
            <ListField
              label="سطرها"
              values={question.settings?.rows ?? []}
              onChange={(rows) => setSettings({ rows })}
            />
            <ListField
              label="ستون‌ها"
              values={question.settings?.columns ?? []}
              onChange={(columns) => setSettings({ columns })}
            />
          </>
        )}

        {/* ── Image ──────────────────────────────────────────────────────── */}
        {question.type === 'IMAGE' && (
          <FormField label="نشانی تصویر">
            <Input
              value={question.settings?.imageUrl ?? ''}
              onChange={(event) => setSettings({ imageUrl: event.target.value })}
              placeholder="https://…"
              // rtl-ok: a URL is read left-to-right.
              dir="ltr"
              className="text-start"
            />
          </FormField>
        )}

        <Separator />

        <BackgroundField
          formId={builder.form.id}
          value={question.settings?.backgroundImageUrl}
          onChange={(backgroundImageUrl) => setSettings({ backgroundImageUrl })}
        />

        <Separator />

        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive"
          onClick={() => builder.removeQuestion(question.id)}
        >
          <Trash2 className="size-4" />
          حذف این پرسش
        </Button>
      </div>
    </ScrollArea>
  );
}

const SUPPORTS_PLACEHOLDER = new Set([
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'EMAIL',
  'PHONE',
  'URL',
  'DROPDOWN',
]);

const SUPPORTS_DEFAULT = new Set(['SHORT_TEXT', 'NUMBER', 'EMAIL', 'PHONE', 'URL']);

const SUPPORTS_LABELS = new Set(['NUMERIC_SCALE', 'NPS', 'SLIDER']);

const HAS_OPTIONS = new Set([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
  'IMAGE_CHOICE',
  'RANKING',
]);

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <FormField label={label}>
      <Input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? undefined : Number(event.target.value))
        }
        // rtl-ok: a number is read left-to-right.
        dir="ltr"
        className="text-start"
      />
    </FormField>
  );
}

/**
 * The options of a choice question: add, rename, reorder, remove.
 *
 * Reordering is two buttons rather than a drag: the list is short, it sits in a
 * narrow panel, and a drag target that small is harder to hit than it is worth.
 */
function OptionEditor({
  options,
  onChange,
}: {
  options: FormOption[];
  onChange: (options: FormOption[]) => void;
}) {
  const move = (index: number, direction: -1 | 1) => {
    const next = [...options];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">گزینه‌ها</p>

      {options.map((option, index) => (
        <div key={option.id} className="flex items-center gap-1">
          <span className="text-muted-foreground" aria-hidden>
            <GripVertical className="size-3.5" />
          </span>
          <Input
            value={option.label}
            onChange={(event) =>
              onChange(
                options.map((candidate) =>
                  candidate.id === option.id
                    ? { ...candidate, label: event.target.value }
                    : candidate
                )
              )
            }
            className="h-8"
            aria-label={`گزینهٔ ${index + 1}`}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="بالا"
            disabled={index === 0}
            onClick={() => move(index, -1)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="پایین"
            disabled={index === options.length - 1}
            onClick={() => move(index, 1)}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="حذف گزینه"
            disabled={options.length <= 1}
            onClick={() => onChange(options.filter((candidate) => candidate.id !== option.id))}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          onChange([...options, { id: newId(), label: `گزینهٔ ${options.length + 1}` }])
        }
      >
        <Plus className="size-3.5" />
        افزودن گزینه
      </Button>
    </div>
  );
}

/** A plain list of strings — the matrix's rows and columns. */
function ListField({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>

      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-1">
          <Input
            value={value}
            onChange={(event) =>
              onChange(values.map((entry, position) => (position === index ? event.target.value : entry)))
            }
            className="h-8"
            aria-label={`${label} ${index + 1}`}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="حذف"
            onClick={() => onChange(values.filter((_, position) => position !== index))}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onChange([...values, `${label} ${values.length + 1}`])}
      >
        <Plus className="size-3.5" />
        افزودن
      </Button>
    </div>
  );
}
