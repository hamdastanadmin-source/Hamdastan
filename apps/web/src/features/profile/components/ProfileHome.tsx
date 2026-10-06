import { CircleHelp, Settings, UserRoundPen } from 'lucide-react';

import type { AccountOverview } from '@hamdastan/types';

import { BottomNav, Screen, ScreenBody, ScreenHeader } from '@/components';

import { BadgesCard } from './BadgesCard';
import { IdentityBlock } from './IdentityBlock';
import { ListGroup, ListRow } from './ListGroup';
import { SocialProfileSection } from './SocialProfileSection';

/**
 * The account hub — "my identity, my profile", not a settings page and not a
 * game dashboard. One card per group, top to bottom:
 *
 *   1. the avatar
 *   2. «نشان‌های من»: the badges earned
 *   3. the social profile (or the questionnaire, as a mission)
 *   4. «حساب»: edit profile, settings and help
 *
 * At most one primary (violet) action: the questionnaire, while it is open.
 * Everything else is neutral.
 */
export function ProfileHome({ overview }: { overview: AccountOverview }) {
  return (
    <Screen>
      <ScreenHeader />

      <ScreenBody className="gap-4 pb-10">
        <IdentityBlock
          profile={overview.profile}
          character={overview.socialProfile?.role?.avatarId ?? null}
        />

        <BadgesCard badges={overview.badges} />

        <SocialProfileSection result={overview.socialProfile} />

        <ListGroup title="حساب">
          <ListRow icon={UserRoundPen} label="ویرایش پروفایل" href="/profile/edit" />
          <ListRow icon={Settings} label="تنظیمات" href="/profile/settings" />
          <ListRow icon={CircleHelp} label="راهنما و پشتیبانی" href="/profile/help" />
        </ListGroup>
      </ScreenBody>

      <BottomNav />
    </Screen>
  );
}
