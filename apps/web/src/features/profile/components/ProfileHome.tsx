import { Settings, UserRoundPen } from 'lucide-react';

import type { AccountOverview } from '@hamdastan/types';

import { BottomNav, Screen, ScreenBody, ScreenHeader } from '@/components';

import { primaryMissionOf, rewardFrom } from '../utils/account-view';
import { IdentityBlock } from './IdentityBlock';
import { ListGroup, ListRow } from './ListGroup';
import { MissionsSection } from './MissionsSection';
import { ProgressSection } from './ProgressSection';
import { SocialProfileSection } from './SocialProfileSection';

/**
 * The account hub — "my identity, my progress, my profile", not a settings
 * page and not a game dashboard. Top to bottom, in the order that matters:
 *
 *   1. identity and avatar, with level and XP
 *   2. the social profile (or the questionnaire, as a mission)
 *   3. missions
 *   4. progress and recent XP
 *   5. the way to settings
 *
 * Exactly one primary (violet) action: the next open mission. Everything
 * else is neutral.
 */
export function ProfileHome({
  overview,
  rewardParam,
}: {
  overview: AccountOverview;
  /** `?reward=<missionId>`, set by a save that just earned one. */
  rewardParam?: string | string[];
}) {
  const primaryId = primaryMissionOf(overview.missions);
  const reward = rewardFrom(rewardParam, overview);

  return (
    <Screen>
      <ScreenHeader />

      <ScreenBody className="gap-10 pb-10">
        <IdentityBlock profile={overview.profile} progress={overview.progress} gained={reward?.xp ?? 0} />

        <SocialProfileSection
          result={overview.socialProfile}
          testIsPrimary={primaryId === 'personality_test'}
        />

        <MissionsSection
          missions={overview.missions}
          primaryId={primaryId}
          freshId={reward?.missionId ?? null}
        />

        <ProgressSection progress={overview.progress} />

        <ListGroup>
          <ListRow icon={UserRoundPen} label="ویرایش پروفایل" href="/profile/edit" />
          <ListRow icon={Settings} label="تنظیمات" href="/profile/settings" />
        </ListGroup>
      </ScreenBody>

      <BottomNav />
    </Screen>
  );
}
