'use client';

import { JOURNEY_TIMEZONES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { zonedMidnight } from '@hamdastan/shared/time-zone';
import type { JourneySettings } from '@hamdastan/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@hamdastan/ui';

import { formatDayTimeIn } from '@/lib';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { Field, invalid, SwitchRow } from './Field';

const ZONE_LABELS: Record<(typeof JOURNEY_TIMEZONES)[number], string> = {
  'Asia/Tehran': 'تهران',
  UTC: 'UTC',
  'Asia/Dubai': 'دبی',
  'Europe/Istanbul': 'استانبول',
  'Europe/London': 'لندن',
};

/**
 * Step 6 for a journey: the campaign's start, how its days open, and what a
 * person may do with a day they missed. The end is not entered — it is the
 * midnight after the last day, worked out exactly as the API does — and the
 * day-by-day timeline below shows what the settings mean.
 */
export function JourneySchedule({ editor }: { editor: ActivityEditorApi }) {
  const { state, update, updateDefinition, errors } = editor;
  const journey = state.definition.journey!;
  const days = state.definition.steps;
  const setJourney = (patch: Partial<JourneySettings>) => updateDefinition({ journey: { ...journey, ...patch } });

  const start = state.startsAt ? new Date(state.startsAt) : null;
  const valid = start && !Number.isNaN(start.getTime());
  const calendar = journey.unlockMode === 'calendar_day';
  const opensAt = (index: number) =>
    valid ? (index === 0 ? start : zonedMidnight(start, journey.timezone, index)).toISOString() : null;
  const end = valid ? zonedMidnight(start, journey.timezone, days.length).toISOString() : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="زمان شروع کمپین" htmlFor="starts-at" error={errors.startsAt} hint="روز اول همین لحظه باز می‌شه.">
          <Input
            id="starts-at"
            type="datetime-local"
            dir="ltr"
            value={state.startsAt}
            onChange={(event) => update({ startsAt: event.target.value })}
            {...invalid(errors.startsAt)}
          />
        </Field>
        <Field label="پایان کمپین" hint="خودکار: نیمه‌شبِ بعد از آخرین روز.">
          <p className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
            {end ? formatDayTimeIn(end, journey.timezone) : 'اول زمان شروع رو انتخاب کن'}
          </p>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="باز شدن روزها" htmlFor="unlock-mode">
          <Select value={journey.unlockMode} onValueChange={(value) => setJourney({ unlockMode: value as JourneySettings['unlockMode'] })}>
            <SelectTrigger id="unlock-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="calendar_day">روز تقویمی — هر نیمه‌شب یک روز تازه</SelectItem>
              <SelectItem value="rolling_24h">۲۴ ساعت بعد از تکمیل روز قبل</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="منطقه‌ی زمانی" htmlFor="timezone" error={errors['definition.journey.timezone']} hint="نیمه‌شب‌ها به وقت این منطقه حساب می‌شن.">
          <Select value={journey.timezone} onValueChange={(timezone) => setJourney({ timezone })}>
            <SelectTrigger id="timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {JOURNEY_TIMEZONES.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {ZONE_LABELS[zone]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Accordion type="single" collapsible className="rounded-lg border px-4">
        <AccordionItem value="access" className="border-b-0">
          <AccordionTrigger>قوانین دسترسی</AccordionTrigger>
          <AccordionContent className="flex flex-col gap-4">
            {calendar && (
              <Field label="روزهای ازدست‌رفته" htmlFor="missed-days">
                <Select value={journey.missedDays} onValueChange={(value) => setJourney({ missedDays: value as JourneySettings['missedDays'] })}>
                  <SelectTrigger id="missed-days" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catch_up">تا پایان کمپین باز می‌مونن</SelectItem>
                    <SelectItem value="lock">با باز شدن روز بعد، قفل می‌شن</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            {calendar && (
              <SwitchRow
                id="require-previous"
                label="الزام تکمیل روز قبل"
                hint="روشن باشه، هر روز فقط بعد از تکمیل (یا ازدست‌رفتنِ) روز قبلش باز می‌شه."
              >
                <Switch
                  id="require-previous"
                  checked={journey.requirePreviousDay}
                  onCheckedChange={(requirePreviousDay) => setJourney({ requirePreviousDay })}
                />
              </SwitchRow>
            )}
            <SwitchRow id="allow-review" label="مرور روزهای تکمیل‌شده" hint="کاربر می‌تونه سؤال‌ها و پاسخ‌های روزهای تموم‌شده رو دوباره ببینه.">
              <Switch id="allow-review" checked={journey.allowReview} onCheckedChange={(allowReview) => setJourney({ allowReview })} />
            </SwitchRow>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <section aria-labelledby="timeline" className="flex flex-col gap-3">
        <h3 id="timeline" className="text-sm font-medium text-muted-foreground">
          برنامه‌ی باز شدن روزها
        </h3>
        <ol className="flex flex-col divide-y rounded-lg border">
          {days.map((day, index) => {
            const at = opensAt(index);
            return (
              <li key={day.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">
                  {toPersianDigits(index + 1)}. {day.title}
                </span>
                <span className="text-muted-foreground">
                  {index > 0 && !calendar
                    ? '۲۴ ساعت بعد از تکمیل روز قبل'
                    : at
                      ? formatDayTimeIn(at, journey.timezone)
                      : '—'}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
