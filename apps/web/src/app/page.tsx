import Link from 'next/link';

import { BottomNav, PersonSilhouette, RoleCharacter, Screen, ScreenBody, ScreenHeader } from '@/components';
import { ActivitiesSection } from '@/features/activities';
import { SoonEventsSection, UpcomingEventsSection } from '@/features/events';
import { getSoonEvents, getUpcomingEvents } from '@/features/events/server';
import { getMyActivities } from '@/features/activities/server';
import { NotificationBell } from '@/features/notifications';
import { getUnreadCount } from '@/features/notifications/server';
import { PersonalityTestCard } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';
import { WorldsPicker } from '@/features/worlds';
import { getHomeWorlds } from '@/features/worlds/server';

export const dynamic = 'force-dynamic';

/**
 * Home.
 *
 * Reached only by an account the API reports as complete. First, always,
 * «جهان‌های هم‌داستان» — a row that opens a sheet of every published world.
 * Below it, until the questionnaire is done, the offer to do it — the
 * screen's one primary action; once it is done that card is gone (the
 * result lives in the profile). Then the reminders, the next few events and
 * the person's open activities from Engagement Studio.
 *
 * Signing out is not here; it lives in the profile's settings.
 */
export default async function HomePage() {
  const [{ profile, socialProfile }, activities, events, soon, unread, worlds] = await Promise.all([
    getAccountOverview(),
    getMyActivities(),
    getUpcomingEvents(),
    getSoonEvents(),
    getUnreadCount(),
    getHomeWorlds(),
  ]);

  return (
    <Screen>
      <ScreenHeader>
        <Link
          href="/profile"
          className="-ms-1 flex items-center gap-3 rounded-full py-1 pe-3 ps-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block size-10 overflow-hidden rounded-full border border-border bg-secondary">
            {socialProfile?.role?.avatarId ? (
              <RoleCharacter avatarId={socialProfile.role.avatarId} frame="portrait" sizes="72px" className="size-full" />
            ) : (
              <PersonSilhouette className="size-full" />
            )}
          </span>
          <h1 className="text-sm font-bold leading-tight">
            {profile.username ? <bdi dir="ltr">@{profile.username}</bdi> : profile.displayName}
          </h1>
        </Link>
        <NotificationBell unread={unread} />
      </ScreenHeader>

      <ScreenBody className="gap-6 pt-4">
        <WorldsPicker worlds={worlds} />

        {!socialProfile && (
          <PersonalityTestCard
            title="یه قدم مونده تا بیشتر بشناسیمت"
            body="هرچی بیشتر بشناسیمت، پیشنهادهای جذاب‌تری برات داریم. لازم نیست همه‌چی رو همین الان کامل کنی؛ هر وقت خواستی برگرد و ادامه بده."
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          />
        )}

        <SoonEventsSection events={soon} />

        <UpcomingEventsSection events={events} without={soon} />

        <ActivitiesSection cards={activities} />
      </ScreenBody>

      <BottomNav />
    </Screen>
  );
}
