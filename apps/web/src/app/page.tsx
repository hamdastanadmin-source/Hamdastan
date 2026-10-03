import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { DEFAULT_AVATAR } from '@hamdastan/config';

import { BottomNav, Screen, ScreenBody, ScreenHeader } from '@/components';
import { AvatarFigure, PersonalityTestCard } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const dynamic = 'force-dynamic';

/** The story worlds on offer, in display order. Sources live in `assets/worlds/`. */
const WORLD_BANNERS = [
  { src: '/images/worlds/hogwarts-banner-v2.png', alt: 'هاگوارتز، هری پاتر' },
  { src: '/images/worlds/gta-banner-v2.png', alt: 'جی تی ای' },
  { src: '/images/worlds/game-of-thrones-banner-v2.png', alt: 'بازی تاج و تخت' },
  { src: '/images/worlds/liverpool-banner.png', alt: 'لیورپول، تنها قدم نخواهی زد' },
] as const;

/**
 * Home.
 *
 * Reached only by an account the API reports as complete. It carries the
 * person's next step, then the story-world picker. Until the questionnaire is
 * done, the first thing on the screen is the offer to do it
 * — the screen's one primary action. Once it is done that card is gone, and a
 * quiet line points to the result instead.
 *
 * Signing out is not here; it lives in the profile's settings.
 */
export default async function HomePage() {
  const { profile, socialProfile } = await getAccountOverview();
  const name = profile.displayName ?? 'دوست من';

  return (
    <Screen>
      <ScreenHeader>
        <Link
          href="/profile"
          className="-ms-1 flex items-center gap-3 rounded-full py-1 pe-3 ps-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block size-10 overflow-hidden rounded-full border border-border bg-secondary">
            <AvatarFigure avatar={profile.avatar ?? DEFAULT_AVATAR} frame="portrait" label="" className="size-full" />
          </span>
          <span className="flex flex-col">
            <span className="text-2xs text-muted-foreground">خوش برگشتی</span>
            <h1 className="text-sm font-bold leading-tight">{name}</h1>
          </span>
        </Link>
      </ScreenHeader>

      <ScreenBody className="gap-6 pt-4">
        {socialProfile ? (
          <Link
            href="/profile/social"
            className="flex min-h-14 items-center gap-3 rounded-2xl border border-border px-4 py-3 text-sm outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-semibold">پروفایل اجتماعی‌ات آماده‌ست</span>
              <span className="text-xs text-muted-foreground">{socialProfile.title}</span>
            </span>
            <span className="text-xs text-muted-foreground">مشاهده نتیجه</span>
            {/* rtl-ok: "forward" points left in an RTL layout. */}
            <ChevronLeft aria-hidden="true" className="size-4 text-muted-foreground" />
          </Link>
        ) : (
          <PersonalityTestCard
            title="یه قدم مونده تا بیشتر بشناسیمت"
            body="آزمون کوتاهت رو کامل کن تا تجربه‌ها و آدم‌های مناسب‌تری برات پیدا کنیم."
            className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          />
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold leading-tight">جهان داستانی‌ات را انتخاب کن</h2>
          <ul className="flex flex-col gap-3">
            {WORLD_BANNERS.map((world) => (
              <li key={world.src}>
                <Image
                  src={world.src}
                  alt={world.alt}
                  width={1290}
                  height={344}
                  sizes="(max-width: 430px) 100vw, 430px"
                  className="h-auto w-full rounded-2xl border border-border"
                />
              </li>
            ))}
          </ul>
        </section>
      </ScreenBody>

      <BottomNav />
    </Screen>
  );
}
