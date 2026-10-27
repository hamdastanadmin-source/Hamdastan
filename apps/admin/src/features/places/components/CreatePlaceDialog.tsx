'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import type { AdminPlaceDetail } from '@hamdastan/types';
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
} from '@hamdastan/ui';
import { placeCreateSchema, type z } from '@hamdastan/validation';

import { errorMessage, fieldErrors } from '@/lib';
import { adminPlacesService } from '@/services';

type CreateInput = z.input<typeof placeCreateSchema>;
type CreateOutput = z.output<typeof placeCreateSchema>;

/**
 * A new place: a world's map — its name and which world it belongs to — or
 * a place inside another, which needs only a name and is pinned in the
 * middle of its parent's image until it is moved.
 */
export function CreatePlaceDialog({
  target,
  open,
  onOpenChange,
  onCreated,
}: {
  /** A map, for one of these worlds (the ones without a map); or a place inside `parent`. */
  target: { worlds: { id: string; name: string }[] } | { parent: { id: string; name: string; worldId: string } };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (place: AdminPlaceDetail) => void;
}) {
  const parent = 'parent' in target ? target.parent : null;
  const worlds = 'worlds' in target ? target.worlds : [];
  const form = useForm<CreateInput, unknown, CreateOutput>({
    resolver: zodResolver(placeCreateSchema),
    values: { worldId: parent?.worldId ?? (worlds.length === 1 ? worlds[0].id : ''), parentId: parent?.id ?? null, name: '' },
  });

  const submit = form.handleSubmit(async (input) => {
    try {
      const place = await adminPlacesService.create(input);
      toast.success(parent ? `«${place.name}» داخل «${parent.name}» ساخته شد` : `نقشه‌ی «${place.world.name}» ساخته شد`);
      onOpenChange(false);
      onCreated(place);
    } catch (error) {
      const byField = fieldErrors(error);
      if (byField.name) return form.setError('name', { message: byField.name }, { shouldFocus: true });
      toast.error(errorMessage(error));
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{parent ? `مکان جدید داخل «${parent.name}»` : 'نقشه‌ی جدید'}</DialogTitle>
          <DialogDescription>
            {parent
              ? `پین آن وسط تصویر «${parent.name}» قرار می‌گیرد؛ بعد می‌توانید جابه‌جایش کنید.`
              : 'هر جهان یک نقشه دارد که بالای صفحه‌ی خانه‌ی آن جهان نمایش داده می‌شود. مکان‌ها روی آن پین می‌شوند.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="create-place" onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>نام</FormLabel>
                  <FormControl>
                    <Input {...field} autoComplete="off" autoFocus placeholder={parent ? 'مثلاً خانه' : 'مثلاً لوس سانتوس'} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!parent && (
              <FormField
                control={form.control}
                name="worldId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>جهان</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange} disabled={worlds.length === 0}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={worlds.length === 0 ? 'همه‌ی جهان‌ها نقشه دارند' : 'جهان را انتخاب کنید'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {worlds.map((world) => (
                          <SelectItem key={world.id} value={world.id}>
                            {world.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>فقط جهان‌هایی که هنوز نقشه ندارند.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="submit" form="create-place" loading={form.formState.isSubmitting}>
            ساخت
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
