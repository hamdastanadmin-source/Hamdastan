import Link from 'next/link';
import { Pencil } from 'lucide-react';

import { DEFAULT_AVATAR } from '@hamdastan/config';
import type { AccountProfile, AccountProgress } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { ScreenTitle } from '@/components';

import { AvatarFigure } from './AvatarFigure';
import { XpProgressBar } from './XpProgressBar';

/**
 * The top of the hub: who this is and how far they have come. One block,
 * no card — the avatar, the name (the screen's `h1`), the username, the
 * level bar and the two ways to change any of it, both secondary: the
 * screen's one primary action is further down, on whatever mission is next.
 *
 * Before an avatar is saved the default one stands in, and its action reads
 * «آواتارت رو بساز».
 */
export function IdentityBlock({
  profile,
  progress,
  gained,
}: {
  profile: AccountProfile;
  progress: AccountProgress;
  gained: number;
}) {
  const name = profile.displayName ?? 'دوست من';

  return (
    <section aria-label="هویت من" className="flex flex-col items-center gap-5">
      <Link
        href="/profile/avatar"
        aria-label="ویرایش آواتار"
        className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <span className="block size-28 overflow-hidden rounded-full border border-border bg-secondary animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
          <AvatarFigure avatar={profile.avatar ?? DEFAULT_AVATAR} frame="portrait" label="" className="size-full" />
        </span>
        <span className="absolute bottom-0.5 end-0.5 flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground">
          <Pencil aria-hidden="true" className="size-3.5" />
        </span>
      </Link>

      <ScreenTitle
        className="items-center text-center"
        title={name}
        description={
          profile.username ? (
            <bdi dir="ltr">@{profile.username}</bdi>
          ) : (
            <Link href="/profile/edit" className="underline-offset-4 hover:text-foreground hover:underline">
              یه نام کاربری انتخاب کن
            </Link>
          )
        }
      />

      <XpProgressBar progress={progress} gained={gained} />

      <div className="grid w-full grid-cols-2 gap-3">
        <Button asChild variant="outline" size="touch">
          <Link href="/profile/edit">ویرایش پروفایل</Link>
        </Button>
        <Button asChild variant="outline" size="touch">
          <Link href="/profile/avatar">{profile.avatar ? 'ویرایش آواتار' : 'آواتارت رو بساز'}</Link>
        </Button>
      </div>
    </section>
  );
}
