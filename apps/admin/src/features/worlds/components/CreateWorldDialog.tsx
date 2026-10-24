'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { WORLD_DEFAULT_NAVIGATION } from '@hamdastan/config';
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
} from '@hamdastan/ui';
import { worldInputSchema, type z } from '@hamdastan/validation';

import { errorMessage, fieldErrors } from '@/lib';
import { adminWorldsService } from '@/services';

/** A new world needs a name and a slug; everything else is set on its page. */
const startSchema = worldInputSchema.pick({ name: true, slug: true });
type StartInput = z.input<typeof startSchema>;
type StartOutput = z.output<typeof startSchema>;

/**
 * Starts a world: a draft with the default menu and home, opened on its own
 * page for the rest — identity, menu, home — before it is published.
 */
export function CreateWorldDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const form = useForm<StartInput, unknown, StartOutput>({ resolver: zodResolver(startSchema), defaultValues: { name: '', slug: '' } });

  const submit = form.handleSubmit(async (input) => {
    try {
      const world = await adminWorldsService.create({
        ...input,
        summary: '',
        tagline: '',
        description: '',
        coverId: null,
        theme: 'neutral',
        navigation: WORLD_DEFAULT_NAVIGATION.map((item) => ({ ...item })),
      });
      toast.success('دنیای جدید به‌صورت پیش‌نویس ساخته شد');
      router.push(`/worlds/${world.id}`);
    } catch (error) {
      const byField = fieldErrors(error);
      if (byField.slug || byField.name) {
        if (byField.name) form.setError('name', { message: byField.name });
        if (byField.slug) form.setError('slug', { message: byField.slug }, { shouldFocus: true });
        return;
      }
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>دنیای جدید</DialogTitle>
          <DialogDescription>دنیا پیش‌نویس ساخته می‌شود و تا منتشر نشود در اپلیکیشن دیده نمی‌شود.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="create-world" onSubmit={submit} className="flex flex-col gap-4" noValidate>
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
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="create-world" loading={form.formState.isSubmitting}>
            ساخت و ادامه
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
