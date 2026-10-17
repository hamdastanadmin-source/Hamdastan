'use client';

import { Alert, AlertDescription, Input } from '@hamdastan/ui';

import { Field, invalid } from '@/components';
import { formatDateTime } from '@/lib';

import type { EditorState } from '../../utils/draft';
import type { SectionProps } from './types';

/** The input's local time, read back in Jalali — the browser's picker speaks Gregorian. */
const jalali = (value: string) => (value ? formatDateTime(new Date(value).toISOString()) : undefined);

/**
 * D. When the event happens and until when people may sign up. When it is
 * *published* is separate — the «انتشار» section.
 */
export function ScheduleSection({ editor }: SectionProps) {
  const { state, update, errors } = editor;

  const dateField = (key: 'startAt' | 'endAt' | 'registrationDeadline', label: string, hint: string) => (
    <Field label={label} htmlFor={key} error={errors[key]} hint={jalali(state[key]) ?? hint}>
      <Input
        id={key}
        type="datetime-local"
        dir="ltr"
        value={state[key]}
        onChange={(event) => update({ [key]: event.target.value } as Partial<EditorState>)}
        {...invalid(errors[key])}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        {dateField('startAt', 'شروع', 'لازم برای انتشار.')}
        {dateField('endAt', 'پایان', 'باید بعد از شروع باشه. رویداد چندروزه همه‌ی روزهاش توی تقویم علامت می‌خوره.')}
        {dateField('registrationDeadline', 'مهلت ثبت‌نام', 'اختیاری؛ خالی یعنی تا پایان رویداد.')}
        <Field label="منطقه‌ی زمانی" hint="زمان‌ها با ساعت تهران ذخیره و نمایش داده می‌شن.">
          <Input value={state.timeZone} dir="ltr" readOnly />
        </Field>
      </div>
      <Alert>
        <AlertDescription>زمان انتشار رویداد جداست و توی بخش «انتشار» تعیین می‌شه.</AlertDescription>
      </Alert>
    </div>
  );
}
