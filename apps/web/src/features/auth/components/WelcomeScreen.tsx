import { Fragment } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';

import { Button, ThemeToggle } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

/**
 * First contact: what the product is, in one look.
 *
 * A server component; `ThemeToggle` is the one client island on it. The
 * entrance is `tailwindcss-animate`'s `animate-in`, which is CSS: it plays on
 * first paint without waiting for hydration, and `motion-reduce` turns it off
 * for anyone who has asked for less movement.
 */

const HEADLINE = 'دنیاهای داستانی‌ات منتظرتن';
const WORDS = HEADLINE.split(' ');

/**
 * The entrance, in milliseconds.
 *
 * The headline arrives a word at a time rather than as one block — it is the
 * product's one promise, and staggering it makes the eye read it rather than
 * just see it. The step is at the slow end of the 30–50ms a list stagger
 * usually wants: there are only three words, and a faster step would be over
 * before it registered as motion at all.
 */
const MOTION = {
  /** The first word, after the artwork has settled. */
  headlineStart: 200,
  /** One word to the next. */
  wordStep: 90,
  /** After the last word, before the line underneath. */
  afterHeadline: 80,
} as const;

/**
 * The hero motion. `unoptimized` because the image optimiser would hand back
 * a single still frame; the file is already a compressed WebP at its display
 * size. The source lives in `assets/illustrations/welcome-hero.webp`.
 */
const HERO = {
  motion: '/images/brand/welcome-hero.webp',
  still: '/images/brand/welcome-hero-still.webp',
} as const;

const { props: heroProps } = getImageProps({
  src: HERO.motion,
  alt: '',
  width: 640,
  height: 360,
  priority: true,
  unoptimized: true,
});

const SUBTITLE_DELAY =
  MOTION.headlineStart + WORDS.length * MOTION.wordStep + MOTION.afterHeadline;

export function WelcomeScreen() {
  return (
    <Screen>
      {/* No lockup here. The mark and the name were repeating what the
          artwork below already says, and they were taking the top of the
          screen to do it. What a first screen does need is the theme switch:
          this is the first thing a visitor sees and the only screen where
          they have nothing else to do. */}
      <ScreenHeader className="justify-end">
        <div className="-me-3 animate-in fade-in duration-500 motion-reduce:animate-none">
          <ThemeToggle />
        </div>
      </ScreenHeader>

      <ScreenBody center className="gap-10 text-center">
        <div className="relative animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
          {/* A halo behind the artwork so it sits *in* the screen rather than
              on top of it. A square halo the width of the column: it must not
              spread sideways, or the page gains a horizontal scroll at
              320px. */}
          <div
            aria-hidden="true"
            className="hero-glow inset-x-0 top-1/2 aspect-square -translate-y-1/2"
          />
          {/* An animated WebP rather than a video: it needs no player, no
              poster and no autoplay policy. Anyone who has asked for less
              movement gets its first frame instead — an animated image cannot
              be paused by `motion-reduce`, so the swap happens in `<picture>`. */}
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={HERO.still} />
            <img
              {...heroProps}
              alt=""
              // Capped in both directions: the artwork fills the column's
              // width but never grows past a phone-sized illustration,
              // whatever the browser is doing outside the shell.
              className="relative mx-auto h-auto max-h-[300px] w-full rounded-2xl object-cover"
            />
          </picture>
        </div>

        {/* Not `ScreenTitle`: that is the screen-title scale (24px over a
            14px line), and this is the product's one hero headline. Keeping
            them separate is what stops the hero size leaking into every
            other screen's h1. */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-3xl font-extrabold leading-tight">
            {WORDS.map((word, index) => (
              // The space between words stays a real text node rather than
              // becoming a flex gap: an inline-block with no whitespace
              // around it is announced as one run-on word by some screen
              // readers, and the heading has to survive being heard as well
              // as seen. `fill-mode-backwards` is what holds each word
              // hidden through its own delay instead of showing it, hiding
              // it, then animating it in.
              <Fragment key={`${word}-${index}`}>
                <span
                  className="inline-block animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-backwards motion-reduce:animate-none"
                  style={{
                    animationDelay: `${MOTION.headlineStart + index * MOTION.wordStep}ms`,
                  }}
                >
                  {word}
                </span>
                {index < WORDS.length - 1 ? ' ' : null}
              </Fragment>
            ))}
          </h1>
          {/* The one element that keeps moving: `animate-rise-loop` brings
              the line in slowly and replays it every 5s, after the headline. */}
          <p
            className="max-w-sm text-balance text-base leading-relaxed text-muted-foreground animate-rise-loop fill-mode-backwards motion-reduce:animate-none"
            style={{ animationDelay: `${SUBTITLE_DELAY}ms` }}
          >
            بازی کن، امتیاز بگیر و با بقیه‌ی طرفدارها رقابت کن.
          </p>
        </div>
      </ScreenBody>

      {/* `delay-700` rather than a computed delay: `ScreenFooter` sets its own
          `style` for the safe-area padding, so this one lands on the nearest
          step of the scale above SUBTITLE_DELAY. */}
      <ScreenFooter className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 delay-700 duration-500 fill-mode-backwards motion-reduce:animate-none">
        <Button asChild size="xl" className="w-full">
          <Link href="/auth/phone">شروع کنیم</Link>
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          ورود و ثبت‌نام، هر دو با شماره موبایل
        </p>
      </ScreenFooter>
    </Screen>
  );
}
