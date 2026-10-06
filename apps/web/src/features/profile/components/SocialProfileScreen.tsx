import { DEFAULT_AVATAR, type AvatarConfig } from '@hamdastan/config';
import type { QuestionnaireResult } from '@hamdastan/types';

import { Screen, ScreenBack, ScreenBody, ScreenHeader } from '@/components';
import { SocialProfileResult } from '@/features/onboarding';

import { AvatarFigure } from './AvatarFigure';

/**
 * The full social-profile result, reopened from the profile — the same
 * content the questionnaire ended on, with a back control instead of the
 * way on.
 */
export function SocialProfileScreen({
  result,
  avatar,
}: {
  result: QuestionnaireResult;
  avatar: AvatarConfig | null;
}) {
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile" />
      </ScreenHeader>

      <ScreenBody className="gap-6 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
        <SocialProfileResult
          result={result}
          eyebrow="پروفایل اجتماعی من"
          avatar={<AvatarFigure avatar={avatar ?? DEFAULT_AVATAR} frame="portrait" label="" className="size-full" />}
        />

        <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
          از این شناخت استفاده می‌کنیم تا آدم‌ها، گروه‌ها و تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم.
        </p>
      </ScreenBody>
    </Screen>
  );
}
