'use client';

import { Alert, AlertDescription, Input } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { Field, invalid } from './Field';

/**
 * Step 6: when it opens and closes. A start in the future makes a publish a
 * schedule — the activity reads «زمان‌بندی‌شده» and appears on its own. The
 * end is also a mission's deadline.
 */
export function ScheduleStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, update, errors } = editor;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="شروع" htmlFor="starts-at" error={errors.startsAt} hint="خالی یعنی از لحظه‌ی انتشار.">
          <Input
            id="starts-at"
            type="datetime-local"
            dir="ltr"
            value={state.startsAt}
            onChange={(event) => update({ startsAt: event.target.value })}
            {...invalid(errors.startsAt)}
          />
        </Field>
        <Field
          label={state.type === 'mission' ? 'پایان (مهلت انجام)' : 'پایان'}
          htmlFor="ends-at"
          error={errors.endsAt}
          hint="خالی یعنی تا وقتی خودت ببندیش."
        >
          <Input
            id="ends-at"
            type="datetime-local"
            dir="ltr"
            value={state.endsAt}
            onChange={(event) => update({ endsAt: event.target.value })}
            {...invalid(errors.endsAt)}
          />
        </Field>
      </div>
      <Alert>
        <AlertDescription>
          اعلان (پوش یا پیامک) برای فعالیت‌های جدید هنوز ممکن نیست: محصول ماژول اعلان نداره. فعالیت منتشرشده توی صفحه‌ی
          خانه‌ی مخاطبانش نشون داده می‌شه.
        </AlertDescription>
      </Alert>
    </div>
  );
}
