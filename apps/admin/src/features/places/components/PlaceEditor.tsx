'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

import { PLACE_LIMITS, PLACE_MAX_DEPTH, PLACE_STATUS_LABELS } from '@hamdastan/config';
import type { AdminPlaceDetail, PlaceInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Textarea,
} from '@hamdastan/ui';
import { placeInputSchema, placePublishProblems, type PlaceInputOutput } from '@hamdastan/validation';

import { useAdminCan } from '@/features/auth';
import { MediaField, useMediaAsset } from '@/features/media';
import { errorMessage, fieldErrors } from '@/lib';
import { adminPlacesService } from '@/services';

import { usePlaceActions } from '../hooks/use-place-actions';
import { useWorldActivities } from '../hooks/use-world-activities';
import { toForm, type PlaceFormInput } from '../utils/form';
import { DEPTH_LABELS, PLACE_ACTION_LABELS, PLACE_STATUS_BADGE } from '../utils/labels';
import { ConfirmDialog } from './ConfirmDialog';
import { CreatePlaceDialog } from './CreatePlaceDialog';
import { PinBoard } from './PinBoard';
import { TasksSection } from './TasksSection';

/**
 * One place's page in the panel: its name and image, the places inside it
 * pinned on that image, and its tasks — one form, saved together.
 * Publishing saves first, and needs a name and an image.
 */
export function PlaceEditor({ initial }: { initial: AdminPlaceDetail }) {
  const router = useRouter();
  const can = useAdminCan();
  const writable = can('worlds.manage');
  const [place, setPlace] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const activities = useWorldActivities(place.worldId);
  const parent = place.parentId ? { id: place.parentId } : null;

  /** The place as the API has it now — after a place inside it was added, published or deleted. The form keeps what is typed. */
  const reload = async () => setPlace(await adminPlacesService.get(place.id));
  const actions = usePlaceActions({
    onChanged: () => void reload(),
    onDeleted: (id) => {
      if (id === place.id) return router.push(parent ? `/places/${parent.id}` : '/places');
      // A deleted place's pin goes with it, without the form counting as changed.
      form.setValue('pins', (form.getValues('pins') ?? []).filter((pin) => pin.id !== id), { shouldDirty: false });
      void reload();
    },
  });

  const form = useForm<PlaceFormInput, unknown, PlaceInputOutput>({ resolver: zodResolver(placeInputSchema), defaultValues: toForm(initial) });
  const values = useWatch({ control: form.control }) as PlaceInput;
  const { asset: image } = useMediaAsset(values.imageId ?? null);
  const problems = placePublishProblems({ name: values.name ?? '', imageId: values.imageId ?? null });

  /** Saves the form; answers false when something needs fixing. */
  const saveForm = () =>
    new Promise<boolean>((resolve) => {
      form.handleSubmit(
        async (input) => {
          try {
            const detail = await adminPlacesService.update(place.id, input);
            setPlace(detail);
            form.reset(toForm(detail));
            resolve(true);
          } catch (error) {
            const byField = Object.entries(fieldErrors(error));
            byField.forEach(([field, message]) => form.setError(field as keyof PlaceFormInput, { message }));
            if (byField.length === 0) toast.error(errorMessage(error));
            resolve(false);
          }
        },
        () => resolve(false)
      )();
    });

  const save = async () => {
    setBusy(true);
    if (await saveForm()) toast.success('تغییرات ذخیره شد');
    setBusy(false);
  };

  const publish = async () => {
    setBusy(true);
    // What is published is what is on the screen.
    if (!form.formState.isDirty || (await saveForm())) await actions.run(place, 'publish');
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href={parent ? `/places/${parent.id}` : '/places'}>
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              {parent ? 'مکان والد' : 'نقشه‌ها'}
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
            {place.name}
            <Badge variant={PLACE_STATUS_BADGE[place.status]}>{PLACE_STATUS_LABELS[place.status]}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            {DEPTH_LABELS[place.depth]} · {place.world.name}
          </p>
        </div>
        {writable && (
          <div className="flex flex-wrap gap-2">
            {place.status === 'draft' && place.children.length === 0 && (
              <Button variant="outline" disabled={busy} onClick={() => actions.remove(place)}>
                حذف
              </Button>
            )}
            {place.status === 'published' && (
              <Button variant="outline" disabled={busy} onClick={() => actions.run(place, 'unpublish')}>
                {PLACE_ACTION_LABELS.unpublish}
              </Button>
            )}
            <Button variant={place.status === 'draft' ? 'outline' : 'default'} onClick={save} loading={busy} disabled={!form.formState.isDirty}>
              ذخیره‌ی تغییرات
            </Button>
            {place.status === 'draft' && (
              <Button onClick={publish} loading={busy} disabled={problems.length > 0}>
                {PLACE_ACTION_LABELS.publish}
              </Button>
            )}
          </div>
        )}
      </div>

      {place.status === 'draft' && problems.length > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium">برای انتشار:</p>
            <ul className="mt-1 list-disc ps-5">
              {problems.map((problem) => (
                <li key={problem.field}>{problem.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          noValidate
          className="flex flex-col gap-6"
        >
          <fieldset disabled={!writable} className="contents">
            <Card>
              <CardHeader>
                <CardTitle>مشخصات</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-5">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>نام</FormLabel>
                        <FormControl>
                          <Input {...field} maxLength={PLACE_LIMITS.NAME_MAX} autoComplete="off" />
                        </FormControl>
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
                          <Textarea {...field} rows={3} maxLength={PLACE_LIMITS.SUMMARY_MAX} />
                        </FormControl>
                        <FormDescription>زیر نام مکان در اپلیکیشن. اختیاری.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="imageId"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>تصویر</FormLabel>
                      <MediaField
                        value={field.value}
                        onChange={field.onChange}
                        kind="image"
                        category="place"
                        pickerTitle={`تصویر «${place.name}»`}
                        invalid={Boolean(fieldState.error)}
                      />
                      <FormDescription>PNG، JPEG یا WebP تا ۵۱۲ کیلوبایت. مکان‌های داخل این‌جا روی همین تصویر پین می‌شوند.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مکان‌های داخل «{values.name || place.name}»</CardTitle>
                <CardDescription>
                  {place.depth < PLACE_MAX_DEPTH
                    ? 'هر مکان داخلی یک پین روی تصویر بالا است؛ کاربر با زدن پین واردش می‌شود.'
                    : 'این مکان در لایه‌ی دوم است؛ مکانی داخلش ساخته نمی‌شود.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PinBoard
                  image={image ?? null}
                  places={place.children}
                  pins={values.pins ?? []}
                  writable={writable}
                  canAdd={place.depth < PLACE_MAX_DEPTH}
                  actions={actions}
                  onChange={(pins) => form.setValue('pins', pins, { shouldDirty: true })}
                  onAdd={() => setAdding(true)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>تسک‌های این مکان</CardTitle>
              </CardHeader>
              <CardContent>
                <TasksSection
                  ids={values.activityIds ?? []}
                  worldId={place.worldId}
                  activities={activities}
                  writable={writable}
                  onChange={(ids) => form.setValue('activityIds', ids, { shouldDirty: true })}
                />
                {form.formState.errors.activityIds && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {form.formState.errors.activityIds.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </fieldset>
        </form>
      </Form>

      <CreatePlaceDialog
        target={{ parent: { id: place.id, name: place.name, worldId: place.worldId } }}
        open={adding}
        onOpenChange={setAdding}
        onCreated={(child) => {
          // It stays here, pinned in the middle, ready to be moved.
          form.setValue('pins', [...(form.getValues('pins') ?? []), { id: child.id, ...child.pin }], { shouldDirty: false });
          void reload();
        }}
      />
      <ConfirmDialog {...actions.dialog} />
    </div>
  );
}
