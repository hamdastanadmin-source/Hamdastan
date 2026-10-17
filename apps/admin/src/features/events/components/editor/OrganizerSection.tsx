'use client';

import { IMAGE_FRAMES } from '@hamdastan/config';
import { Input } from '@hamdastan/ui';

import { Field, invalid } from '@/components';
import { MediaField } from '@/features/media';

import type { SectionProps } from './types';

/** F. Who runs it. Optional; without a name the detail page leaves the section out. */
export function OrganizerSection({ editor }: SectionProps) {
  const { state, update, errors } = editor;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="نام برگزارکننده" htmlFor="organizer" error={errors.organizerName}>
        <Input id="organizer" value={state.organizerName} onChange={(event) => update({ organizerName: event.target.value })} {...invalid(errors.organizerName)} />
      </Field>
      <Field label="راه تماس" htmlFor="contact" error={errors.organizerContact} hint="اختیاری؛ مثلاً ایمیل یا شماره‌ی عمومی.">
        <Input id="contact" value={state.organizerContact} onChange={(event) => update({ organizerContact: event.target.value })} {...invalid(errors.organizerContact)} />
      </Field>
      <Field label="لوگو" error={errors.organizerLogoId}>
        <MediaField
          value={state.organizerLogoId}
          onChange={(organizerLogoId) => update({ organizerLogoId })}
          kind="image"
          pickerTitle="لوگوی برگزارکننده"
          invalid={Boolean(errors.organizerLogoId)}
          frame={IMAGE_FRAMES.logo}
        />
      </Field>
    </div>
  );
}
