'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { IMAGE_FRAMES } from '@hamdastan/config';
import type { AdminWorld, WorldInput } from '@hamdastan/types';
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
  Switch,
  Textarea,
} from '@hamdastan/ui';
import { worldInputSchema } from '@hamdastan/validation';
import type { z } from '@hamdastan/validation';

import { MediaField } from '@/features/media';
import { errorCode, errorMessage, fieldErrors } from '@/lib';

type WorldFormInput = z.input<typeof worldInputSchema>;
const FIELDS = ['slug', 'name', 'summary', 'coverId', 'isActive'] as const;

/**
 * Add or edit a world. The same schema as the API; a slug another world has
 * comes back from the server and lands under its field. The parent remounts
 * this per world (by `key`), which resets the form.
 */
export function WorldFormDialog({
  open,
  onOpenChange,
  world,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  world?: AdminWorld;
  onSubmit: (input: WorldInput) => Promise<unknown>;
}) {
  const form = useForm<WorldFormInput, unknown, WorldInput>({
    resolver: zodResolver(worldInputSchema),
    defaultValues: {
      slug: world?.slug ?? '',
      name: world?.name ?? '',
      summary: world?.summary ?? '',
      coverId: world?.coverId ?? null,
      isActive: world?.isActive ?? true,
    },
  });

  const submit = form.handleSubmit(async (input) => {
    try {
      await onSubmit(input);
      toast.success(world ? 'تغییرات ذخیره شد' : 'دنیای جدید اضافه شد');
      onOpenChange(false);
    } catch (error) {
      const byField = fieldErrors(error);
      const known = FIELDS.filter((field) => byField[field]);
      if (known.length > 0) {
        for (const field of known) form.setError(field, { message: byField[field] });
        return;
      }
      if (errorCode(error) === 'WORLD_SLUG_TAKEN') {
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
          <DialogTitle>{world ? 'ویرایش دنیا' : 'دنیای جدید'}</DialogTitle>
          <DialogDescription>رویدادها به دنیاها متصل می‌شوند؛ دنیای غیرفعال در اپلیکیشن نمایش داده نمی‌شود.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="world-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
                    <Input {...field} dir="ltr" autoComplete="off" placeholder="hogwarts" />
                  </FormControl>
                  <FormDescription>بخشی از نشانی صفحه‌ی دنیا؛ فقط حروف کوچک انگلیسی، عدد و خط تیره.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>توضیح کوتاه</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="coverId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>کاور</FormLabel>
                  <MediaField
                    value={field.value}
                    onChange={field.onChange}
                    kind="image"
                    category="cover"
                    pickerTitle="کاور دنیا"
                    invalid={Boolean(fieldState.error)}
                    frame={IMAGE_FRAMES.worldCover}
                  />
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
          <Button type="submit" form="world-form" loading={form.formState.isSubmitting}>
            {world ? 'ذخیره' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
