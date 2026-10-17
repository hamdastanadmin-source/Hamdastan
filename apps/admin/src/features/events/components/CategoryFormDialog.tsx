'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { EVENT_CATEGORY_ICONS } from '@hamdastan/config';
import type { AdminEventCategory, EventCategoryInput } from '@hamdastan/types';
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
  Switch,
  Textarea,
} from '@hamdastan/ui';
import { Icon } from '@hamdastan/ui/icons';
import { eventCategoryInputSchema } from '@hamdastan/validation';
import type { z } from '@hamdastan/validation';

import { MediaField } from '@/features/media';
import { errorCode, errorMessage, fieldErrors } from '@/lib';

type CategoryFormInput = z.input<typeof eventCategoryInputSchema>;
const FIELDS = ['slug', 'name', 'description', 'icon', 'imageId', 'isActive'] as const;

/**
 * Add or edit an event category. The slug is its identity — renaming keeps
 * every event filed under it. The icon shows when there is no image. The
 * parent remounts this per category (by `key`), which resets the form.
 */
export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: AdminEventCategory;
  onSubmit: (input: EventCategoryInput) => Promise<unknown>;
}) {
  const form = useForm<CategoryFormInput, unknown, EventCategoryInput>({
    resolver: zodResolver(eventCategoryInputSchema),
    defaultValues: {
      slug: category?.slug ?? '',
      name: category?.name ?? '',
      description: category?.description ?? '',
      icon: category?.icon ?? 'sparkles',
      imageId: category?.imageId ?? null,
      isActive: category?.isActive ?? true,
    },
  });

  const submit = form.handleSubmit(async (input) => {
    try {
      await onSubmit(input);
      toast.success(category ? 'تغییرات ذخیره شد' : 'دسته‌ی جدید اضافه شد');
      onOpenChange(false);
    } catch (error) {
      const byField = fieldErrors(error);
      const known = FIELDS.filter((field) => byField[field]);
      if (known.length > 0) {
        for (const field of known) form.setError(field, { message: byField[field] });
        return;
      }
      if (errorCode(error) === 'EVENT_CATEGORY_SLUG_TAKEN') {
        form.setError('slug', { message: errorMessage(error) }, { shouldFocus: true });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'ویرایش دسته' : 'دسته‌ی جدید'}</DialogTitle>
          <DialogDescription>دسته‌ها توی فیلترهای کشف رویداد و روی کارت رویدادها دیده می‌شن.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="category-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نامک</FormLabel>
                  <FormControl>
                    <Input {...field} dir="ltr" autoComplete="off" placeholder="music" />
                  </FormControl>
                  <FormDescription>شناسه‌ی ثابت دسته توی نشانی‌ها؛ فقط حروف کوچک انگلیسی، عدد و خط تیره.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیح</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>آیکن</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EVENT_CATEGORY_ICONS.map((icon) => (
                        <SelectItem key={icon} value={icon}>
                          <Icon name={icon} aria-hidden="true" className="size-4" />
                          <span dir="ltr">{icon}</span>
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
              name="imageId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>تصویر (اختیاری)</FormLabel>
                  <MediaField
                    value={field.value}
                    onChange={field.onChange}
                    kind="image"
                    pickerTitle="تصویر دسته"
                    invalid={Boolean(fieldState.error)}
                  />
                  <FormDescription>اگه باشه، به‌جای آیکن نشون داده می‌شه.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <FormLabel>فعال</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="category-form" loading={form.formState.isSubmitting}>
            {category ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
