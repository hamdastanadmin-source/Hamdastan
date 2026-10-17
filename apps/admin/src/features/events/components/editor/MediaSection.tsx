'use client';

import { X } from 'lucide-react';

import { EVENT_LIMITS, IMAGE_FRAMES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button, Input } from '@hamdastan/ui';

import { Field, invalid } from '@/components';
import { MediaField } from '@/features/media';

import type { SectionProps } from './types';

/**
 * B. The cover and the gallery, from the media library — never a file in
 * the code. Every image has alt text for people who cannot see it.
 */
export function MediaSection({ editor }: SectionProps) {
  const { state, update, errors } = editor;
  const gallery = state.gallery;
  const setItem = (index: number, patch: Partial<(typeof gallery)[number]>) =>
    update({ gallery: gallery.map((item, i) => (i === index ? { ...item, ...patch } : item)) });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="کاور" error={errors.coverId} hint="تصویر اصلی رویداد، روی کارت و بالای صفحه‌ی رویداد، در قاب ۱۶:۹.">
          <MediaField
            value={state.coverId}
            onChange={(coverId) => update({ coverId })}
            kind="image"
            category="cover"
            pickerTitle="کاور رویداد"
            invalid={Boolean(errors.coverId)}
            frame={IMAGE_FRAMES.eventCover}
          />
        </Field>
        <Field label="متن جایگزین کاور" htmlFor="cover-alt" error={errors.coverAlt} hint="چیزی که توی تصویره، برای صفحه‌خوان‌ها.">
          <Input id="cover-alt" value={state.coverAlt} onChange={(event) => update({ coverAlt: event.target.value })} {...invalid(errors.coverAlt)} />
        </Field>
      </div>

      <Field
        label="گالری"
        error={errors.gallery}
        hint={`اختیاری، حداکثر ${toPersianDigits(EVENT_LIMITS.GALLERY_MAX)} تصویر، به همین ترتیب نمایش داده می‌شن.`}
      >
        <ul className="flex flex-col gap-3">
          {gallery.map((item, index) => {
            const error = errors[`gallery.${index}.mediaId`];
            return (
              <li key={item.mediaId} className="grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto]">
                <MediaField
                  value={item.mediaId}
                  onChange={(mediaId) => (mediaId ? setItem(index, { mediaId }) : update({ gallery: gallery.filter((_, i) => i !== index) }))}
                  kind="image"
                  pickerTitle="تصویر گالری"
                  invalid={Boolean(error)}
                />
                <Input
                  aria-label={`متن جایگزین تصویر ${toPersianDigits(index + 1)}`}
                  placeholder="متن جایگزین"
                  value={item.alt}
                  onChange={(event) => setItem(index, { alt: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => update({ gallery: gallery.filter((_, i) => i !== index) })}
                  aria-label={`حذف تصویر ${toPersianDigits(index + 1)}`}
                >
                  <X aria-hidden="true" />
                </Button>
                {error && (
                  <p role="alert" className="text-xs text-destructive sm:col-span-3">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {gallery.length < EVENT_LIMITS.GALLERY_MAX && (
          <MediaField
            value={null}
            onChange={(mediaId) => mediaId && !gallery.some((item) => item.mediaId === mediaId) && update({ gallery: [...gallery, { mediaId, alt: '' }] })}
            kind="image"
            pickerTitle="افزودن به گالری"
            frame={IMAGE_FRAMES.eventCover}
          />
        )}
      </Field>
    </div>
  );
}
