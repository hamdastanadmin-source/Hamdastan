'use client';

import { Input, Textarea } from '@hamdastan/ui';

import { Field, invalid } from '@/components';

import type { EditorState } from '../../utils/draft';
import type { SectionProps } from './types';

/**
 * E. Where: a place for a physical event, a link and instructions for an
 * online one, both for a hybrid. The link is only sent to people who may
 * join — an open event, or a confirmed booking.
 */
export function VenueSection({ editor }: SectionProps) {
  const { state, update, errors } = editor;
  const text = (key: keyof EditorState, value: string) => update({ [key]: value } as Partial<EditorState>);

  return (
    <div className="flex flex-col gap-6">
      {state.type !== 'online' && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="نام محل" htmlFor="venue" error={errors.venueName}>
            <Input id="venue" value={state.venueName} onChange={(event) => text('venueName', event.target.value)} {...invalid(errors.venueName)} />
          </Field>
          <Field label="شهر" htmlFor="city" error={errors.city}>
            <Input id="city" value={state.city} onChange={(event) => text('city', event.target.value)} {...invalid(errors.city)} />
          </Field>
          <Field label="نشانی" htmlFor="address" error={errors.address} className="sm:col-span-2">
            <Input id="address" value={state.address} onChange={(event) => text('address', event.target.value)} {...invalid(errors.address)} />
          </Field>
          <Field label="عرض جغرافیایی" htmlFor="lat" error={errors.latitude} hint="اختیاری، برای دکمه‌ی مسیریابی.">
            <Input id="lat" dir="ltr" inputMode="decimal" placeholder="35.6997" value={state.latitude} onChange={(event) => text('latitude', event.target.value)} {...invalid(errors.latitude)} />
          </Field>
          <Field label="طول جغرافیایی" htmlFor="lng" error={errors.longitude}>
            <Input id="lng" dir="ltr" inputMode="decimal" placeholder="51.3380" value={state.longitude} onChange={(event) => text('longitude', event.target.value)} {...invalid(errors.longitude)} />
          </Field>
        </div>
      )}

      {state.type !== 'physical' && (
        <div className="flex flex-col gap-5">
          <Field label="لینک شرکت آنلاین" htmlFor="online-url" error={errors.onlineUrl} hint="فقط برای کسانی ارسال می‌شود که امکان شرکت دارند.">
            <Input
              id="online-url"
              dir="ltr"
              type="url"
              placeholder="https://"
              value={state.onlineUrl ?? ''}
              onChange={(event) => update({ onlineUrl: event.target.value || null })}
              {...invalid(errors.onlineUrl)}
            />
          </Field>
          <Field label="راهنمای شرکت آنلاین" htmlFor="online-instructions" error={errors.onlineInstructions}>
            <Textarea
              id="online-instructions"
              rows={4}
              value={state.onlineInstructions}
              onChange={(event) => text('onlineInstructions', event.target.value)}
              {...invalid(errors.onlineInstructions)}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
