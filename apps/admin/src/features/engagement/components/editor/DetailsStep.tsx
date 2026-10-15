'use client';

import { useState } from 'react';

import { ENGAGEMENT_LIMITS, JOURNEY_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { dayTitle, emptyStep, isUntouchedStep } from '../../utils/draft';
import { Field, invalid, SwitchRow } from './Field';

const int = (value: string, min: number) => Math.max(min, Math.trunc(Number(value) || min));

/**
 * Step 2: what the person reads before starting — and the settings that
 * shape how they take part (time, repeats, anonymity, review).
 */
export function DetailsStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, update, updateDefinition, errors } = editor;
  const { definition } = state;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Field label="عنوان" htmlFor="title" error={errors.title} className="lg:col-span-2">
        <Input
          id="title"
          value={state.title}
          maxLength={ENGAGEMENT_LIMITS.TITLE_MAX}
          onChange={(event) => update({ title: event.target.value })}
          {...invalid(errors.title)}
        />
      </Field>
      <Field
        label="توضیح کوتاه"
        htmlFor="summary"
        error={errors.summary}
        hint="روی کارت فعالیت توی اپ دیده می‌شه."
        className="lg:col-span-2"
      >
        <Input
          id="summary"
          value={state.summary}
          maxLength={ENGAGEMENT_LIMITS.SUMMARY_MAX}
          onChange={(event) => update({ summary: event.target.value })}
          {...invalid(errors.summary)}
        />
      </Field>
      <Field
        label="توضیحات و دستورالعمل"
        htmlFor="instructions"
        error={errors.instructions}
        hint="قبل از شروع نشون داده می‌شه. تصویر فعلاً پشتیبانی نمی‌شه: سرویس ذخیره‌ی فایل هنوز به بک‌اند وصل نیست."
        className="lg:col-span-2"
      >
        <Textarea
          id="instructions"
          rows={5}
          value={state.instructions}
          onChange={(event) => update({ instructions: event.target.value })}
          {...invalid(errors.instructions)}
        />
      </Field>

      {state.type === 'journey' && <JourneyLength editor={editor} />}

      <Field
        label={state.type === 'journey' ? 'مدت تقریبی هر روز (دقیقه)' : 'مدت تقریبی (دقیقه)'}
        htmlFor="minutes"
        error={errors['definition.estimatedMinutes']}
      >
        <Input
          id="minutes"
          type="number"
          min={1}
          max={ENGAGEMENT_LIMITS.ESTIMATED_MINUTES_MAX}
          className="tabular-nums"
          value={definition.estimatedMinutes}
          onChange={(event) => updateDefinition({ estimatedMinutes: int(event.target.value, 1) })}
        />
      </Field>
      {state.type !== 'journey' && (
        <Field
          label="تعداد دفعات مجاز پاسخ‌دهی"
          htmlFor="repeats"
          error={errors['definition.maxSubmissions']}
          hint={`هر نفر چند بار می‌تونه ثبت کنه (حداکثر ${toPersianDigits(ENGAGEMENT_LIMITS.REPEAT_MAX)}).`}
        >
          <Input
            id="repeats"
            type="number"
            min={1}
            max={ENGAGEMENT_LIMITS.REPEAT_MAX}
            className="tabular-nums"
            value={definition.maxSubmissions}
            onChange={(event) => updateDefinition({ maxSubmissions: int(event.target.value, 1) })}
          />
        </Field>
      )}

      {state.type === 'survey' && (
        <SwitchRow
          id="anonymous"
          label="پاسخ ناشناس"
          hint="پاسخ‌ها بدون هویت ذخیره می‌شن؛ گزارش و خروجی هیچ‌کس رو به پاسخش وصل نمی‌کنه. XP همچنان داده می‌شه."
        >
          <Switch
            id="anonymous"
            checked={definition.anonymous}
            onCheckedChange={(anonymous) => updateDefinition({ anonymous })}
          />
        </SwitchRow>
      )}

      {state.type === 'mission' && (
        <Field
          label="تأیید انجام"
          htmlFor="review"
          hint="با تأیید مدیر، مأموریت تا بررسی تو «در انتظار تأیید» می‌مونه و XP بعد از تأیید داده می‌شه."
        >
          <Select
            value={definition.review}
            onValueChange={(review) => updateDefinition({ review: review as 'auto' | 'manual' })}
          >
            <SelectTrigger id="review" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">تأیید توسط مدیر</SelectItem>
              <SelectItem value="auto">تأیید خودکار</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

/**
 * A journey's length and its daily target. Days are added at the end; a
 * day is taken off the end only while nothing has been written in it, so
 * shortening the journey never throws questions away.
 */
function JourneyLength({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const { steps, journey } = state.definition;
  const [blocked, setBlocked] = useState<string | null>(null);

  const setDays = (count: number) => {
    const target = Math.min(JOURNEY_LIMITS.DAYS_MAX, Math.max(1, count));
    if (target > steps.length) {
      const added = Array.from({ length: target - steps.length }, (_, i) => emptyStep(dayTitle(steps.length + i + 1)));
      updateDefinition({ steps: [...steps, ...added] });
      setBlocked(null);
      return;
    }
    const removed = steps.slice(target);
    const kept = removed.findLastIndex((step) => !isUntouchedStep(step));
    if (kept !== -1) {
      setBlocked(`روز ${toPersianDigits(target + kept + 1)} محتوا داره؛ اول سؤال‌هاش رو جابه‌جا یا حذف کن.`);
      return;
    }
    updateDefinition({ steps: steps.slice(0, target) });
    setBlocked(null);
  };

  return (
    <>
      <Field
        label="تعداد روزها"
        htmlFor="days"
        error={blocked ?? errors['definition.steps']}
        hint={`هر روز یک مرحله با سؤال‌های خودش (حداکثر ${toPersianDigits(JOURNEY_LIMITS.DAYS_MAX)} روز).`}
      >
        <Input
          id="days"
          type="number"
          min={1}
          max={JOURNEY_LIMITS.DAYS_MAX}
          className="tabular-nums"
          value={steps.length}
          onChange={(event) => setDays(int(event.target.value, 1))}
          {...invalid(blocked ?? undefined)}
        />
      </Field>
      <Field
        label="هدف تعداد سؤال در هر روز"
        htmlFor="questions-per-day"
        error={errors['definition.journey.questionsPerDay']}
        hint="فقط راهنمای ساخت: توی تب سؤال‌ها کنار هر روز نشون داده می‌شه."
      >
        <Input
          id="questions-per-day"
          type="number"
          min={1}
          max={JOURNEY_LIMITS.QUESTIONS_PER_DAY_MAX}
          className="tabular-nums"
          value={journey?.questionsPerDay ?? 1}
          onChange={(event) =>
            journey &&
            updateDefinition({
              journey: { ...journey, questionsPerDay: Math.min(JOURNEY_LIMITS.QUESTIONS_PER_DAY_MAX, int(event.target.value, 1)) },
            })
          }
        />
      </Field>
    </>
  );
}
