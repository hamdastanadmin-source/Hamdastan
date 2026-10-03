import Link from 'next/link';
import { ChevronLeft, Compass, Sparkles } from 'lucide-react';

import { APP_NAME, DEFAULT_AVATAR } from '@hamdastan/config';
import { IconBadge } from '@hamdastan/ui';

import { BottomNav, Screen, ScreenBody, ScreenHeader } from '@/components';
import { AvatarFigure, PersonalityTestCard } from '@/features/profile';
import { getAccountOverview } from '@/features/profile/server';

export const dynamic = 'force-dynamic';

/**
 * Home.
 *
 * Reached only by an account the API reports as complete. The worlds are not
 * open yet, so what it carries today is the person's next step: until the
 * questionnaire is done, the first thing on the screen is the offer to do it
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

        <section className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
          <IconBadge tone="muted">
            <Compass aria-hidden="true" />
          </IconBadge>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-bold leading-tight">دنیاها به‌زودی باز می‌شن</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              دنیاهای {APP_NAME} هنوز منتشر نشدن. به‌محض این‌که اولین دنیا باز بشه، همین‌جا می‌بینیش.
            </p>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles aria-hidden="true" className="size-4" />
            به‌زودی
          </p>
        </section>
      </ScreenBody>

      <BottomNav />
    </Screen>
  );
}
