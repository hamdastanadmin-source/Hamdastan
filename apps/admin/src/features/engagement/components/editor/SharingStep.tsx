'use client';

import { JOURNEY_LIMITS } from '@hamdastan/config';
import type { JourneyDayEnd } from '@hamdastan/types';
import { Alert, AlertDescription, Input, Switch, Textarea } from '@hamdastan/ui';

import { MotionSettingField } from '@/features/media';

import type { ActivityEditorApi } from '../../hooks/use-activity-editor';
import { Field, invalid, motionErrors, SwitchRow } from './Field';
import { JourneyResultsPanel } from './JourneyResultsPanel';

/**
 * A journey's step 7, «نتایج و اشتراک‌گذاری»: the final character card, the
 * page each day ends on — its congratulations, its mascot — and the
 * invitation to friends. The link an invitation shares is the journey's own
 * address; a newcomer signs up and is brought back to it.
 */
export function SharingStep({ editor }: { editor: ActivityEditorApi }) {
  const { state, updateDefinition, errors } = editor;
  const journey = state.definition.journey;
  if (!journey) return null;

  const dayEnd = journey.dayEnd;
  const setDayEnd = (patch: Partial<JourneyDayEnd>) => updateDefinition({ journey: { ...journey, dayEnd: { ...dayEnd, ...patch } } });
  const setInvite = (patch: Partial<JourneyDayEnd['invite']>) => setDayEnd({ invite: { ...dayEnd.invite, ...patch } });
  const error = (field: string) => errors[`definition.journey.dayEnd.${field}`];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="final-result" className="flex flex-col gap-4">
        <h3 id="final-result" className="text-base font-semibold">
          نتیجه‌ی نهایی
        </h3>
        <JourneyResultsPanel
          result={journey.result}
          errors={errors}
          onChange={(result) => updateDefinition({ journey: { ...journey, result } })}
        />
      </section>

      <section aria-labelledby="day-end" className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h3 id="day-end" className="text-base font-semibold">
            صفحه‌ی پایان روز
          </h3>
          <p className="text-sm text-muted-foreground">
            پس از جشن پایان روز نمایش داده می‌شود، همراه با تعداد روزهای تکمیل‌شده، XP همان روز و زمان باز شدن روز بعد.
          </p>
        </div>
        <Field
          label="متن تبریک"
          htmlFor="day-end-title"
          error={error('title')}
          hint="{name} با نام کاربر، {day} با شماره‌ی روز و {days} با تعداد کل روزها جایگزین می‌شود."
        >
          <Input
            id="day-end-title"
            value={dayEnd.title}
            maxLength={JOURNEY_LIMITS.DAY_END_TITLE_MAX}
            onChange={(event) => setDayEnd({ title: event.target.value })}
            {...invalid(error('title'))}
          />
        </Field>
        <Field label="پیام" htmlFor="day-end-message" error={error('message')}>
          <Textarea
            id="day-end-message"
            rows={3}
            maxLength={JOURNEY_LIMITS.DAY_END_MESSAGE_MAX}
            value={dayEnd.message}
            onChange={(event) => setDayEnd({ message: event.target.value })}
            {...invalid(error('message'))}
          />
        </Field>
        <Field label="تصویر یا مسکات صفحه">
          <MotionSettingField
            id="day-end-mascot"
            value={dayEnd.mascot}
            onChange={(mascot) => setDayEnd({ mascot })}
            category="celebration"
            errors={motionErrors(errors, 'definition.journey.dayEnd.mascot')}
          />
        </Field>
      </section>

      <section aria-labelledby="invite" className="flex flex-col gap-5">
        <h3 id="invite" className="text-base font-semibold">
          دعوت دوستان
        </h3>
        <SwitchRow id="invite-enabled" label="دکمه‌ی دعوت از دوستان" hint="با اشتراک‌گذاری گوشی، و در صورت پشتیبانی‌نشدن، با کپی لینک.">
          <Switch id="invite-enabled" checked={dayEnd.invite.enabled} onCheckedChange={(enabled) => setInvite({ enabled })} />
        </SwitchRow>
        {dayEnd.invite.enabled && (
          <>
            <Field label="متن تشویق به دعوت" htmlFor="invite-text" error={error('invite.text')}>
              <Textarea
                id="invite-text"
                rows={2}
                maxLength={JOURNEY_LIMITS.DAY_END_MESSAGE_MAX}
                value={dayEnd.invite.text}
                onChange={(event) => setInvite({ text: event.target.value })}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="متن دکمه" htmlFor="invite-button" error={error('invite.button')}>
                <Input
                  id="invite-button"
                  value={dayEnd.invite.button}
                  maxLength={JOURNEY_LIMITS.COVER_BUTTON_MAX}
                  onChange={(event) => setInvite({ button: event.target.value })}
                  {...invalid(error('invite.button'))}
                />
              </Field>
              <Field label="پیام اشتراک‌گذاری" htmlFor="invite-share" hint="لینک چالش به‌طور خودکار پس از این متن قرار می‌گیرد." error={error('invite.shareMessage')}>
                <Textarea
                  id="invite-share"
                  rows={2}
                  maxLength={JOURNEY_LIMITS.SHARE_MESSAGE_MAX}
                  value={dayEnd.invite.shareMessage}
                  onChange={(event) => setInvite({ shareMessage: event.target.value })}
                />
              </Field>
            </div>
            <Alert>
              <AlertDescription>
                لینک دعوت، نشانی همین چالش است؛ کاربر جدید پس از ثبت‌نام مستقیماً به همین چالش هدایت می‌شود. پاداش معرفی هنوز فعال
                نیست.
              </AlertDescription>
            </Alert>
          </>
        )}
      </section>
    </div>
  );
}
