import Image from 'next/image';
import Link from 'next/link';

import { APP_NAME } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter } from '@/components';

/**
 * First contact: what the product is, in one look.
 *
 * A server component — it has no state and no interaction beyond a link, so
 * shipping React for it would buy nothing. The entrance animation is
 * `tailwindcss-animate`'s `animate-in`, which is CSS: it plays on first paint
 * without waiting for hydration, and `motion-reduce` turns it off for anyone
 * who has asked for less movement.
 */
export function WelcomeScreen() {
  return (
    <Screen>
      <ScreenBody className="flex flex-col justify-center gap-8 px-5 pt-6 text-center">
        <div className="animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
          <Image
            src="/images/brand/welcome-hero.svg"
            alt=""
            width={390}
            height={300}
            priority
            // Capped in both directions: the artwork fills the column's
            // width but never grows past a phone-sized illustration, whatever
            // the browser is doing outside the shell.
            className="mx-auto h-auto max-h-[300px] w-full object-contain"
          />
        </div>

        <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-4 delay-150 duration-500 fill-mode-backwards motion-reduce:animate-none">
          {/* The lockup is the app's own mark plus the name as live text,
              rather than a wordmark SVG: the Persian letterforms then come
              from the font the rest of the product is set in, at whatever
              size and weight the screen asks for. */}
          <div className="flex items-center gap-2">
            <Image
              src="/icons/icon.svg"
              alt=""
              width={32}
              height={32}
              priority
              className="size-8 rounded-lg"
            />
            <span className="text-lg font-bold tracking-tight text-foreground">
              {APP_NAME}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold leading-tight text-foreground">
            دنیاهای داستانی‌ات منتظرتن
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            بازی کن، امتیاز بگیر و با بقیه‌ی طرفدارها رقابت کن.
          </p>
        </div>
      </ScreenBody>

      <ScreenFooter className="animate-in fade-in slide-in-from-bottom-2 delay-300 duration-500 fill-mode-backwards motion-reduce:animate-none">
        <Button asChild size="lg" className="h-12 w-full text-base font-bold">
          <Link href="/auth/phone">شروع کنیم</Link>
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
