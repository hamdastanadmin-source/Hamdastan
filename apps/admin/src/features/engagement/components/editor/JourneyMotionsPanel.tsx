'use client';

import type { JourneySettings, MediaCategory } from '@hamdastan/types';

import { MotionSettingField } from '@/features/media';

import { motionErrors } from './Field';

const MOTIONS: { key: keyof JourneySettings['motions']; title: string; hint: string; category: MediaCategory }[] = [
  {
    key: 'answer',
    title: 'بعد از هر پاسخ',
    hint: 'وسط صفحه، بعد از ثبت هر پاسخ و قبل از سؤال بعد. هر روز یا هر سؤال می‌تونه موشن خودش رو داشته باشه.',
    category: 'answer_motion',
  },
  {
    key: 'dayComplete',
    title: 'پایان هر روز',
    hint: 'بعد از آخرین سؤال هر روز، به‌جای موشن پاسخ — جشن تموم شدن مرحله.',
    category: 'celebration',
  },
  {
    key: 'journeyComplete',
    title: 'پایان کل چالش',
    hint: 'بعد از آخرین سؤال آخرین روز.',
    category: 'celebration',
  },
];

/**
 * The journey's own motions. Each is set in one of the five modes; a day's
 * and a question's own answer motion, where set, play instead of the first.
 * If a file fails to load, the player carries on without it.
 */
export function JourneyMotionsPanel({
  motions,
  errors,
  onChange,
}: {
  motions: JourneySettings['motions'];
  errors: Record<string, string>;
  onChange: (motions: JourneySettings['motions']) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h3 className="text-base font-semibold">موشن‌های چالش</h3>
        <p className="text-sm text-muted-foreground">همه‌ی فایل‌ها از کتابخانه‌ی رسانه؛ هیچ موشنی داخل کد ثابت نیست.</p>
      </div>
      {MOTIONS.map(({ key, title, hint, category }) => (
        <section key={key} aria-labelledby={`motion-${key}`} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-col gap-1">
            <h4 id={`motion-${key}`} className="text-sm font-semibold">
              {title}
            </h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
          </div>
          <MotionSettingField
            id={`journey-${key}`}
            value={motions[key]}
            onChange={(next) => onChange({ ...motions, [key]: next })}
            category={category}
            errors={motionErrors(errors, `definition.journey.motions.${key}`)}
          />
        </section>
      ))}
    </div>
  );
}
