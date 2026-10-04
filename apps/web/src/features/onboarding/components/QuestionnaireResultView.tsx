'use client';

import type { QuestionnaireResult } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, XpAmount } from '@/components';

import { SocialProfileResult } from './SocialProfileResult';

/**
 * The questionnaire's payoff: the result, why it matters, and the way on.
 *
 * When finishing has just earned the personality-test reward, one quiet
 * line says so — «پروفایلت آماده‌ست» and «+۵۰ XP گرفتی», rising in once. It
 * is not repeated on a later visit, because the API reports the reward only
 * to the call that granted it.
 */
export function QuestionnaireResultView({
  result,
  xpAwarded,
  isLeaving,
  onContinue,
}: {
  result: QuestionnaireResult;
  xpAwarded: number;
  isLeaving: boolean;
  onContinue: () => void;
}) {
  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader />

      <ScreenBody className="gap-8 pb-4 pt-4 animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
        <SocialProfileResult result={result} eyebrow="پروفایل اجتماعی تو" />

        {xpAwarded > 0 && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-backwards motion-reduce:animate-none"
            style={{ animationDelay: '500ms' }}
          >
            <span className="text-muted-foreground">پروفایلت آماده‌ست</span>
            <span aria-hidden="true" className="text-muted-foreground">·</span>
            <span className="font-semibold">
              <XpAmount value={xpAwarded} signed /> گرفتی
            </span>
          </p>
        )}

        {/* Why the questionnaire was worth it — the last thing read before the action. */}
        <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
          از این شناخت استفاده می‌کنیم تا آدم‌ها، گروه‌ها و تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم.
        </p>
      </ScreenBody>

      <ScreenFooter className="bg-surface-stage/95 before:from-surface-stage">
        <Button type="button" size="xl" className="w-full" loading={isLeaving} onClick={onContinue}>
          ورود به اپلیکیشن
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
