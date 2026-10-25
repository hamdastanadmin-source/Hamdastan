'use client';

import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminInterestCategory, InterestCategoryInput } from '@hamdastan/types';
import {
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hamdastan/ui';
import { interestCategoryInputSchema } from '@hamdastan/validation';
import type { z } from '@hamdastan/validation';

import { errorMessage, fieldErrors } from '@/lib';

type FormInput = z.input<typeof interestCategoryInputSchema>;

/**
 * Add or edit a category of stage 1, with its interests, saved together.
 * An interest keeps its id while it stays in the list — everyone who picked
 * it keeps it, under its new wording — and one removed from the list is
 * deleted. The parent remounts this per category (by `key`), which resets
 * the form.
 */
export function InterestCategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AdminInterestCategory;
  onSubmit: (input: InterestCategoryInput) => Promise<unknown>;
}) {
  const form = useForm<FormInput, unknown, InterestCategoryInput>({
    resolver: zodResolver(interestCategoryInputSchema),
    defaultValues: {
      title: category?.title ?? '',
      interests: category ? category.interests.map(({ id, label }) => ({ id, label })) : [{ label: '' }],
    },
  });
  // `keyName`: the field array's own key must not overwrite the interest's `id`.
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: 'interests', keyName: 'key' });

  const submit = form.handleSubmit(async (input) => {
    try {
      await onSubmit(input);
      toast.success(category ? 'تغییرات ذخیره شد' : 'دسته‌ی جدید اضافه شد');
      onOpenChange(false);
    } catch (error) {
      const byField = fieldErrors(error);
      if (byField.title) form.setError('title', { message: byField.title });
      else toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? 'ویرایش دسته' : 'دسته‌ی جدید'}</DialogTitle>
          <DialogDescription>دسته و علاقه‌مندی‌هایش به همین ترتیب در مرحله‌ی اول آنبوردینگ نمایش داده می‌شوند.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="interest-category-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>عنوان دسته</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">علاقه‌مندی‌ها</legend>
              <ol className="flex flex-col gap-2">
                {fields.map((item, index) => (
                  <li key={item.key} className="flex items-start gap-1">
                    <FormField
                      control={form.control}
                      name={`interests.${index}.label`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} autoComplete="off" aria-label={`علاقه‌مندی ${index + 1}`} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                  </li>
                ))}
              </ol>
              <FormField
                control={form.control}
                name="interests"
                render={() => (
                  <FormItem>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ label: '' })}>
                <Plus aria-hidden="true" />
                افزودن علاقه‌مندی
              </Button>
            </fieldset>
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="interest-category-form" loading={form.formState.isSubmitting}>
            {category ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
