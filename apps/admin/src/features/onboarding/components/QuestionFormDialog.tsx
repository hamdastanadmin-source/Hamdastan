'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Info, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  QUESTIONNAIRE_KIND_LABELS,
  QUESTIONNAIRE_SECTION_LABELS,
  SLIDER_MAX,
  SLIDER_MIN,
  type SectionId,
} from '@hamdastan/config';
import type { AdminQuestion, QuestionInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { questionInputSchema } from '@hamdastan/validation';
import type { z } from '@hamdastan/validation';

import { errorMessage, fieldErrors } from '@/lib';

import { SECTIONS } from '../utils/labels';

type FormInput = z.input<typeof questionInputSchema>;
const FIELDS = ['section', 'kind', 'title', 'helper', 'maxSelections', 'minLabel', 'maxLabel', 'options'] as const;

function defaults(question?: AdminQuestion): FormInput {
  if (!question) {
    return { section: 1, kind: 'single', title: '', helper: '', maxSelections: null, minLabel: '', maxLabel: '', options: [{ label: '' }, { label: '' }] };
  }
  const choice = question.kind !== 'slider';
  return {
    section: question.section,
    kind: question.kind,
    title: question.title,
    helper: question.helper ?? '',
    maxSelections: choice ? (question.maxSelections ?? null) : null,
    minLabel: choice ? '' : question.minLabel,
    maxLabel: choice ? '' : question.maxLabel,
    options: choice ? question.options.map(({ code, label }) => ({ code, label })) : [],
  };
}

/**
 * Add or edit a questionnaire question. A *scored* question feeds the
 * social profile, so only its wording, section and helper can change here;
 * its kind, cap and options' number stay as they are (the API enforces
 * it). A new question is stored and shown but never scored. The parent
 * remounts this per question (by `key`), which resets the form.
 */
export function QuestionFormDialog({
  open,
  onOpenChange,
  question,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: AdminQuestion;
  onSubmit: (input: QuestionInput) => Promise<unknown>;
}) {
  const form = useForm<FormInput, unknown, QuestionInput>({
    resolver: zodResolver(questionInputSchema),
    defaultValues: defaults(question),
  });
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'options', keyName: 'key' });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const locked = question?.scored ?? false;

  const submit = form.handleSubmit(async (input) => {
    try {
      await onSubmit(input);
      toast.success(question ? 'تغییرات ذخیره شد' : 'سؤال جدید اضافه شد');
      onOpenChange(false);
    } catch (error) {
      const byField = fieldErrors(error);
      const known = FIELDS.filter((field) => byField[field]);
      if (known.length > 0) {
        for (const field of known) form.setError(field, { message: byField[field] });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{question ? 'ویرایش سؤال' : 'سؤال جدید'}</DialogTitle>
          <DialogDescription>سؤال در بخش انتخاب‌شده، به ترتیب فهرست، در مرحله‌ی دوم آنبوردینگ پرسیده می‌شود.</DialogDescription>
        </DialogHeader>

        {locked && (
          <Alert>
            <Info aria-hidden="true" />
            <AlertDescription>این سؤال در محاسبه‌ی پروفایل اجتماعی امتیاز می‌گیرد؛ فقط متن‌ها و بخش آن قابل تغییر است.</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form id="question-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>بخش</FormLabel>
                    <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value) as SectionId)}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SECTIONS.map((section) => (
                          <SelectItem key={section} value={String(section)}>
                            {toPersianDigits(section)}. {QUESTIONNAIRE_SECTION_LABELS[section]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نوع پاسخ</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={locked}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(QUESTIONNAIRE_KIND_LABELS) as (keyof typeof QUESTIONNAIRE_KIND_LABELS)[]).map((value) => (
                          <SelectItem key={value} value={value}>
                            {QUESTIONNAIRE_KIND_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>متن سؤال</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="helper"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>راهنما (اختیاری)</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} autoComplete="off" placeholder="مثلاً: حداکثر ۲ مورد" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {kind === 'slider' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="minLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>برچسب {toPersianDigits(SLIDER_MIN)}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxLabel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>برچسب {toPersianDigits(SLIDER_MAX)}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} autoComplete="off" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <>
                {kind !== 'single' && (
                  <FormField
                    control={form.control}
                    name="maxSelections"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>سقف انتخاب (اختیاری)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            className="w-32"
                            disabled={locked}
                            value={field.value ?? ''}
                            onChange={(event) => field.onChange(event.target.value === '' ? null : Number(event.target.value))}
                          />
                        </FormControl>
                        <FormDescription>خالی یعنی «هر چند مورد که مناسب است».</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-sm font-medium">گزینه‌ها</legend>
                  <ol className="flex flex-col gap-2">
                    {fields.map((item, index) => (
                      <li key={item.key} className="flex items-start gap-1">
                        <FormField
                          control={form.control}
                          name={`options.${index}.label`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input {...field} autoComplete="off" aria-label={`گزینه ${index + 1}`} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {!locked && (
                          <>
                            <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="بالا بردن">
                              <ArrowUp aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={index === fields.length - 1}
                              onClick={() => move(index, index + 1)}
                              aria-label="پایین بردن"
                            >
                              <ArrowDown aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => remove(index)}
                              aria-label="حذف"
                            >
                              <X aria-hidden="true" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                  <FormField
                    control={form.control}
                    name="options"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {!locked && (
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ label: '' })}>
                      <Plus aria-hidden="true" />
                      افزودن گزینه
                    </Button>
                  )}
                </fieldset>
              </>
            )}
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="question-form" loading={form.formState.isSubmitting}>
            {question ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
