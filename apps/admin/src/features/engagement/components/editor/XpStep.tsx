'use client';

import { ENGAGEMENT_LIMITS, JOURNEY_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityType, JourneySettings, XpSettings } from '@hamdastan/types';
import { Alert, AlertDescription, Input, Switch } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { Field, invalid, SwitchRow } from './Field';

/** When the reward is paid, by type — the rule the API applies. */
function payRule(type: ActivityType, review: 'auto' | 'manual', requirePass: boolean): string {
  if (type === 'journey') return 'هر پاداش جداگانه و فقط یک بار: با ثبت هر پاسخ، با تکمیل هر روز، و با تکمیل همه‌ی روزها.';
  if (type === 'survey') return 'پس از ثبت موفق یک پاسخ معتبر.';
  if (type === 'mission') {
    return review === 'manual' ? 'پس از تأیید نهایی شما — نه هنگام ثبت.' : 'پس از تکمیل همه‌ی مراحل.';
  }
  return requirePass
    ? 'فقط زمانی که کاربر نمره‌ی قبولی بگیرد.'
    : 'پس از تکمیل آزمون، مستقل از نمره یا نتیجه‌ی شخصیت‌شناسی.';
}

/**
 * Step 5: the reward. The amount, the rule and the cap are stored with this
 * version; changing them later never touches XP already paid.
 */
export function XpStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const { xp, assessment, maxSubmissions, review } = state.definition;
  const setXp = (patch: Partial<XpSettings>) => updateDefinition({ xp: { ...xp, ...patch } });
  const passMarkSet = state.type === 'assessment' && assessment?.mode === 'knowledge' && assessment.passingScore !== null;
  const journey = state.definition.journey;
  const setRewards = (patch: Partial<JourneySettings['rewards']>) =>
    journey && updateDefinition({ journey: { ...journey, rewards: { ...journey.rewards, ...patch } } });
  const xpInput = (value: string) => (value === '' ? Number.NaN : Number(value));

  return (
    <div className="flex flex-col gap-4">
      <SwitchRow id="xp-enabled" label="دریافت XP" hint="اگر خاموش باشد، این فعالیت XP ندارد.">
        <Switch id="xp-enabled" checked={xp.enabled} onCheckedChange={(enabled) => setXp({ enabled })} />
      </SwitchRow>

      {xp.enabled && journey && (
        <JourneyRewards
          perQuestion={journey.rewards.perQuestion}
          perDay={journey.rewards.perDay}
          completion={xp.amount}
          questions={state.definition.steps.reduce((sum, step) => sum + step.questions.length, 0)}
          days={state.definition.steps.length}
          errors={errors}
          onQuestion={(value) => setRewards({ perQuestion: xpInput(value) })}
          onDay={(value) => setRewards({ perDay: xpInput(value) })}
          onCompletion={(value) => setXp({ amount: xpInput(value) })}
        />
      )}

      {xp.enabled && (
        <>
          {!journey && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="مقدار XP" htmlFor="xp-amount" error={errors['definition.xp.amount']} hint="عدد صحیح و نامنفی.">
                <Input
                  id="xp-amount"
                  type="number"
                  min={0}
                  max={ENGAGEMENT_LIMITS.XP_MAX}
                  step={1}
                  className="tabular-nums"
                  value={Number.isNaN(xp.amount) ? '' : xp.amount}
                  onChange={(event) => setXp({ amount: event.target.value === '' ? Number.NaN : Number(event.target.value) })}
                  {...invalid(errors['definition.xp.amount'])}
                />
              </Field>
              <Field
                label="سقف دفعات دریافت XP"
                htmlFor="xp-max"
                error={errors['definition.xp.maxAwards']}
                hint={`پیش‌فرض ۱: حتی اگر کاربر چند بار پاسخ دهد، فقط یک بار XP می‌گیرد. این عدد نمی‌تواند از تعداد دفعات مجاز پاسخ (${toPersianDigits(maxSubmissions)}) بیشتر باشد.`}
              >
                <Input
                  id="xp-max"
                  type="number"
                  min={1}
                  max={maxSubmissions}
                  className="tabular-nums"
                  value={xp.maxAwards}
                  onChange={(event) =>
                    setXp({ maxAwards: Math.min(maxSubmissions, Math.max(1, Math.trunc(Number(event.target.value) || 1))) })
                  }
                />
              </Field>
            </div>
          )}

          <SwitchRow id="xp-show" label="نمایش XP قبل از شروع" hint="روی کارت فعالیت در اپلیکیشن.">
            <Switch id="xp-show" checked={xp.showBeforeStart} onCheckedChange={(showBeforeStart) => setXp({ showBeforeStart })} />
          </SwitchRow>

          {passMarkSet && (
            <SwitchRow
              id="xp-pass"
              label="فقط با قبولی"
              hint={`XP فقط با نمره‌ی ${toPersianDigits(assessment.passingScore!)}٪ یا بیشتر اعطا می‌شود.`}
            >
              <Switch id="xp-pass" checked={xp.requirePass} onCheckedChange={(requirePass) => setXp({ requirePass })} />
            </SwitchRow>
          )}

          <Alert>
            <AlertDescription>
              <span>
                <strong className="font-semibold">شرط اعطا: </strong>
                {payRule(state.type, review, passMarkSet && xp.requirePass)} XP روی سرور محاسبه و ثبت می‌شود و با تغییر بعدی
                این عدد، XPهای اعطاشده تغییر نمی‌کنند.
              </span>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}

/** A journey's three rewards, and the most one person can earn from them. */
function JourneyRewards({
  perQuestion,
  perDay,
  completion,
  questions,
  days,
  errors,
  onQuestion,
  onDay,
  onCompletion,
}: {
  perQuestion: number;
  perDay: number;
  completion: number;
  questions: number;
  days: number;
  errors: Record<string, string>;
  onQuestion: (value: string) => void;
  onDay: (value: string) => void;
  onCompletion: (value: string) => void;
}) {
  const fields = [
    { id: 'xp-question', label: 'XP هر پاسخ', value: perQuestion, max: JOURNEY_LIMITS.STEP_XP_MAX, error: errors['definition.journey.rewards.perQuestion'], onChange: onQuestion },
    { id: 'xp-day', label: 'XP پایان هر روز', value: perDay, max: JOURNEY_LIMITS.STEP_XP_MAX, error: errors['definition.journey.rewards.perDay'], onChange: onDay },
    { id: 'xp-amount', label: 'XP پایان چالش', value: completion, max: ENGAGEMENT_LIMITS.XP_MAX, error: errors['definition.xp.amount'], onChange: onCompletion },
  ];
  const total = [perQuestion * questions, perDay * days, completion].reduce((sum, n) => sum + (Number.isNaN(n) ? 0 : n), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-5 sm:grid-cols-3">
        {fields.map((field) => (
          <Field key={field.id} label={field.label} htmlFor={field.id} error={field.error}>
            <Input
              id={field.id}
              type="number"
              min={0}
              max={field.max}
              step={1}
              className="tabular-nums"
              value={Number.isNaN(field.value) ? '' : field.value}
              onChange={(event) => field.onChange(event.target.value)}
              {...invalid(field.error)}
            />
          </Field>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        بیشترین XP قابل دریافت برای هر نفر: <strong className="font-semibold text-foreground tabular-nums">{toPersianDigits(total)}</strong>
        {' '}({toPersianDigits(questions)} سؤال، {toPersianDigits(days)} روز). به سؤال اختیاری‌ای که رد شود XP تعلق نمی‌گیرد.
      </p>
    </div>
  );
}
