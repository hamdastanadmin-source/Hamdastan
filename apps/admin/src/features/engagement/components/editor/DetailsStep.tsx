'use client';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
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

      <Field label="مدت تقریبی (دقیقه)" htmlFor="minutes" error={errors['definition.estimatedMinutes']}>
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
