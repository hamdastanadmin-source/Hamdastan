import { Fragment } from 'react';
import { getImageProps } from 'next/image';
import Link from 'next/link';

import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter } from '@/components';

/**
 * First contact: what the product is, in one look.
 *
 * A server component with no client island. The entrance is
 * `tailwindcss-animate`'s `animate-in`, which is CSS: it plays on first paint
 * without waiting for hydration, and `motion-reduce` turns it off for anyone
 * who has asked for less movement.
 */

const HEADLINE = 'خوش اومدی به هم‌داستان!';
const WORDS = HEADLINE.split(' ');

/**
 * The entrance, in milliseconds.
 *
 * The headline arrives a word at a time rather than as one block — it is the
 * product's one promise, and staggering it makes the eye read it rather than
 * just see it. The step is at the slow end of the 30–50ms a list stagger
 * usually wants: there are only four words, and a faster step would be over
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
 * The hero artwork: the owl among its stories, drawn on white and framed like
 * the stage owls — the subject clear of the edges (15% at the sides, 11% top
 * and bottom) so the edge fade never reaches it. `unoptimized` because the
 * file is already a compressed WebP at its display size. The source lives in
 * `assets/illustrations/welcome-hero.webp`.
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
      {/* No header. The mark and the name would repeat what the artwork
          already says, and the theme is chosen in settings, not here. */}
      <ScreenBody center className="gap-10 text-center">
        <div className="animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none">
          {/* A WebP rather than a video: it needs no player, no poster and no
              autoplay policy. `<picture>` keeps the reduced-motion still, so
              an animated file can replace this one without touching the
              screen. */}
          <picture>
            <source media="(prefers-reduced-motion: reduce)" srcSet={HERO.still} />
            <img
              {...heroProps}
              alt=""
              // Capped in both directions: the artwork fills the column's
              // width but never grows past a phone-sized illustration,
              // whatever the browser is doing outside the shell. No frame and
              // no corners: its white edges fade into the screen, as on the
              // stage (`StageArtwork`).
              className="mx-auto h-auto max-h-[300px] w-full select-none object-contain [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent),linear-gradient(transparent,black_10%,black_90%,transparent)] dark:opacity-90"
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
            اینجا قراره بیشتر خودتو بشناسی، آدم‌های شبیه خودتو پیدا کنی و اتفاق‌های جالب‌تری رو تجربه کنی.
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
          ورود و ثبت‌نام، هر دو فقط با شماره موبایل
        </p>
      </ScreenFooter>
    </Screen>
  );
}
