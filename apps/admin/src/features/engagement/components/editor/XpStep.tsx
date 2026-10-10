'use client';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityType, XpSettings } from '@hamdastan/types';
import { Alert, AlertDescription, Input, Switch } from '@hamdastan/ui';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { Field, invalid, SwitchRow } from './Field';

/** When the reward is paid, by type — the rule the API applies. */
function payRule(type: ActivityType, review: 'auto' | 'manual', requirePass: boolean): string {
  if (type === 'survey') return 'بعد از ثبت موفق یک پاسخ معتبر.';
  if (type === 'mission') {
    return review === 'manual' ? 'بعد از تأیید نهایی تو — نه موقع ثبت.' : 'بعد از تکمیل همه‌ی مراحل.';
  }
  return requirePass
    ? 'فقط وقتی کاربر نمره‌ی قبولی بگیره.'
    : 'بعد از تکمیل آزمون، مستقل از نمره یا نتیجه‌ی شخصیت‌شناسی.';
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

  return (
    <div className="flex flex-col gap-4">
      <SwitchRow id="xp-enabled" label="دریافت XP" hint="خاموش باشه، این فعالیت XP نمی‌ده.">
        <Switch id="xp-enabled" checked={xp.enabled} onCheckedChange={(enabled) => setXp({ enabled })} />
      </SwitchRow>

      {xp.enabled && (
        <>
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
              hint={`پیش‌فرض ۱: حتی اگه چند بار پاسخ بده، یک بار XP می‌گیره. بیشتر از تعداد دفعات مجاز پاسخ (${toPersianDigits(maxSubmissions)}) نمی‌شه.`}
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

          <SwitchRow id="xp-show" label="نمایش XP قبل از شروع" hint="روی کارت فعالیت توی اپ.">
            <Switch id="xp-show" checked={xp.showBeforeStart} onCheckedChange={(showBeforeStart) => setXp({ showBeforeStart })} />
          </SwitchRow>

          {passMarkSet && (
            <SwitchRow
              id="xp-pass"
              label="فقط با قبولی"
              hint={`XP فقط با نمره‌ی ${toPersianDigits(assessment.passingScore!)}٪ یا بیشتر داده می‌شه.`}
            >
              <Switch id="xp-pass" checked={xp.requirePass} onCheckedChange={(requirePass) => setXp({ requirePass })} />
            </SwitchRow>
          )}

          <Alert>
            <AlertDescription>
              <span>
                <strong className="font-semibold">شرط اعطا: </strong>
                {payRule(state.type, review, passMarkSet && xp.requirePass)} XP روی سرور حساب و ثبت می‌شه و با تغییر بعدیِ
                این عدد، XPهای داده‌شده عوض نمی‌شن.
              </span>
            </AlertDescription>
          </Alert>
        </>
      )}
    </div>
  );
}
