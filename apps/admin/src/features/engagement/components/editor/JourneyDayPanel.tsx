'use client';

import { Trash2 } from 'lucide-react';

import {
  COVER_ENTRY_EFFECT_LABELS,
  COVER_ENTRY_EFFECTS,
  JOURNEY_DEFAULTS,
  JOURNEY_LIMITS,
  MOTION_DURATION,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityStep, CoverEntryEffect, DailyCover } from '@hamdastan/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@hamdastan/ui';
import { motionOff } from '@hamdastan/validation';

import { MediaField, MediaPreview, MotionSettingField, useMediaAsset } from '@/features/media';

import { dayTitle, emptyCover } from '../../utils/draft';
import { Field, invalid, motionErrors, SwitchRow } from './Field';

/**
 * One journey day's own settings: its name, the line above its first
 * question, the cover it opens on, and the motion after its answers. The
 * cover and the motion are optional and folded away; the cover is edited
 * beside a preview of the screen.
 */
export function JourneyDayPanel({
  day,
  number,
  path,
  errors,
  onChange,
  onRemove,
}: {
  day: ActivityStep;
  number: number;
  path: string;
  errors: Record<string, string>;
  onChange: (day: ActivityStep) => void;
  onRemove: (() => void) | null;
}) {
  const cover = day.cover;
  const setCover = (patch: Partial<DailyCover>) => cover && onChange({ ...day, cover: { ...cover, ...patch } });
  const error = (field: string) => errors[`${path}.${field}`];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 border-b pb-4">
        <h3 className="text-base font-semibold">تنظیمات روز {toPersianDigits(number)}</h3>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ms-auto text-muted-foreground hover:text-destructive"
          disabled={!onRemove}
          onClick={() => onRemove?.()}
          aria-label="حذف روز"
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <Field label="نام روز" htmlFor="day-title" error={error('title')} hint="روی تایم‌لاین و کاور روز نمایش داده می‌شود.">
        <Input
          id="day-title"
          value={day.title}
          onChange={(event) => onChange({ ...day, title: event.target.value })}
          {...invalid(error('title'))}
        />
      </Field>
      <Field label="توضیح روز (اختیاری)" htmlFor="day-description" hint="بالای اولین سؤالِ این روز نمایش داده می‌شود.">
        <Textarea
          id="day-description"
          rows={2}
          value={day.description}
          onChange={(event) => onChange({ ...day, description: event.target.value })}
        />
      </Field>

      <Accordion type="single" collapsible defaultValue={cover ? 'cover' : undefined} className="rounded-lg border px-4">
        <AccordionItem value="cover" className="border-b-0">
          <AccordionTrigger>کاور شروع روز</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5">
            <SwitchRow id="cover-enabled" label="کاور اختصاصی" hint="اگر خاموش باشد، روز با کاور پیش‌فرض اپلیکیشن شروع می‌شود.">
              <Switch
                id="cover-enabled"
                checked={Boolean(cover)}
                onCheckedChange={(on) => onChange({ ...day, cover: on ? emptyCover() : undefined })}
              />
            </SwitchRow>

            {cover && (
              <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
                <div className="flex flex-col gap-4">
                  <Field label="تیتر" htmlFor="cover-headline" error={error('cover.headline')}>
                    <Input
                      id="cover-headline"
                      value={cover.headline}
                      maxLength={JOURNEY_LIMITS.COVER_HEADLINE_MAX}
                      placeholder="آماده‌ای امروز بریم سراغ رازهای هاگوارتز؟"
                      onChange={(event) => setCover({ headline: event.target.value })}
                      {...invalid(error('cover.headline'))}
                    />
                  </Field>
                  <Field label="متن کوتاه" htmlFor="cover-text" error={error('cover.text')}>
                    <Textarea
                      id="cover-text"
                      rows={2}
                      maxLength={JOURNEY_LIMITS.COVER_TEXT_MAX}
                      value={cover.text}
                      onChange={(event) => setCover({ text: event.target.value })}
                      {...invalid(error('cover.text'))}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="متن دکمه‌ی شروع" htmlFor="cover-button" error={error('cover.buttonLabel')}>
                      <Input
                        id="cover-button"
                        value={cover.buttonLabel}
                        maxLength={JOURNEY_LIMITS.COVER_BUTTON_MAX}
                        onChange={(event) => setCover({ buttonLabel: event.target.value })}
                        {...invalid(error('cover.buttonLabel'))}
                      />
                    </Field>
                    <Field label="افکت ورود" htmlFor="cover-effect">
                      <Select
                        value={cover.entryEffect}
                        onValueChange={(value) => setCover({ entryEffect: value as CoverEntryEffect })}
                      >
                        <SelectTrigger id="cover-effect" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COVER_ENTRY_EFFECTS.map((effect) => (
                            <SelectItem key={effect} value={effect}>
                              {COVER_ENTRY_EFFECT_LABELS[effect]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <SwitchRow id="cover-background" label="رنگ پس‌زمینه‌ی اختصاصی" hint="اگر خاموش باشد، رنگ زمینه‌ی اپلیکیشن استفاده می‌شود.">
                    <div className="flex items-center gap-3">
                      {cover.background && (
                        <Input
                          type="color"
                          aria-label="رنگ پس‌زمینه"
                          className="h-8 w-12 cursor-pointer p-1"
                          value={cover.background}
                          onChange={(event) => setCover({ background: event.target.value })}
                        />
                      )}
                      <Switch
                        id="cover-background"
                        checked={cover.background !== null}
                        onCheckedChange={(on) => setCover({ background: on ? JOURNEY_DEFAULTS.COVER_BACKGROUND : null })}
                      />
                    </div>
                  </SwitchRow>
                  <Field label="تصویر پس‌زمینه (اختیاری)" error={error('cover.backgroundImageId')}>
                    <MediaField
                      value={cover.backgroundImageId}
                      onChange={(backgroundImageId) => setCover({ backgroundImageId })}
                      kind="image"
                      category="cover"
                      pickerTitle="تصویر پس‌زمینه‌ی کاور"
                      invalid={Boolean(error('cover.backgroundImageId'))}
                    />
                  </Field>
                  <Field label="مسکات وسط صفحه">
                    <MotionSettingField
                      id={`cover-${day.id}-mascot`}
                      value={cover.mascot}
                      onChange={(mascot) => setCover({ mascot })}
                      category="mascot"
                      errors={motionErrors(errors, `${path}.cover.mascot`)}
                    />
                  </Field>
                </div>
                <CoverPreview cover={cover} number={number} title={day.title} />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Accordion type="single" collapsible defaultValue={day.answerMotion ? 'motion' : undefined} className="rounded-lg border px-4">
        <AccordionItem value="motion" className="border-b-0">
          <AccordionTrigger>موشن بعد از پاسخ در این روز</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            <SwitchRow id={`day-${day.id}-motion`} label="موشن اختصاصی این روز" hint="اگر خاموش باشد، موشن عمومی چالش پخش می‌شود. هر سؤال نیز می‌تواند موشن اختصاصی خود را داشته باشد.">
              <Switch
                id={`day-${day.id}-motion`}
                checked={Boolean(day.answerMotion)}
                onCheckedChange={(on) => onChange({ ...day, answerMotion: on ? motionOff(MOTION_DURATION.ANSWER_MS) : undefined })}
              />
            </SwitchRow>
            {day.answerMotion && (
              <MotionSettingField
                id={`day-${day.id}-answer-motion`}
                value={day.answerMotion}
                onChange={(answerMotion) => onChange({ ...day, answerMotion })}
                errors={motionErrors(errors, `${path}.answerMotion`)}
              />
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/** A library file drawn in the cover preview; nothing while it loads or if it is gone. */
function CoverMedia({ id, className }: { id: string; className: string }) {
  const { asset } = useMediaAsset(id);
  return asset ? <MediaPreview asset={asset} className={className} /> : null;
}

/** The cover as the phone will draw it, at a third of its size. */
function CoverPreview({ cover, number, title }: { cover: DailyCover; number: number; title: string }) {
  const mascot = cover.mascot.mode === 'mascot' || cover.mascot.mode === 'custom' ? cover.mascot.assetId : null;
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium text-muted-foreground">پیش‌نمایش</figcaption>
      <div
        className="relative isolate flex aspect-[9/16] w-52 flex-col items-center justify-between overflow-hidden rounded-xl border bg-surface-0 p-4 text-center"
        // The admin's own colour for this day: content, not a design token.
        style={cover.background ? { backgroundColor: cover.background } : undefined}
      >
        {cover.backgroundImageId && (
          <CoverMedia id={cover.backgroundImageId} className="absolute inset-0 -z-10 size-full opacity-60" />
        )}
        <span className="text-xs text-muted-foreground">
          {/* The number, and the day's own name when it has one. */}
          {[dayTitle(number), title !== dayTitle(number) && title].filter(Boolean).join('، ')}
        </span>
        {mascot && <CoverMedia id={mascot} className="size-24" />}
        <div className="flex flex-col gap-2">
          <p className="text-base font-bold leading-snug">{cover.headline || 'تیتر کاور'}</p>
          {cover.text && <p className="text-xs leading-relaxed text-muted-foreground">{cover.text}</p>}
        </div>
        <span className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
          {cover.buttonLabel || 'شروع'}
        </span>
      </div>
    </figure>
  );
}
