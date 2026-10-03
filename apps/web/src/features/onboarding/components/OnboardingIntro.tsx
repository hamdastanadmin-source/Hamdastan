import { getImageProps } from 'next/image';
import Link from 'next/link';

import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { ARRIVE_AFTER_STREAM, STREAM_PACE, StreamedText, streamSequence } from './StreamedText';

/**
 * The door into onboarding: what is about to happen, and why.
 *
 * A server component; the motion is CSS. The text is start-aligned and reads
 * in descending weight — the bold title, then the body, then the quiet line
 * under it — and it streams in in that same order, a word at a time, so the
 * eye is led down the hierarchy rather than handed all of it at once. The
 * action arrives last, once there is something to act on.
 *
 * Top-aligned rather than centred: the text sits a fixed distance below the
 * header on every phone, instead of drifting with the screen's height, and
 * the artwork follows it. The screen is `surface-stage` — black in the dark
 * theme — so the artwork is the only light on it.
 *
 * No header control: the only way on is the button, and stage 1 has its own
 * back to this screen.
 */

const TITLE = 'بیا دنیای تو رو بسازیم';
const BODY =
  'چند قدم کوتاه با هم پیش می‌ریم تا بیشتر بشناسیمت، علایقت رو بفهمیم و در نهایت آواتار شخصی تو رو در دنیای «هم‌داستان» بسازیم.';
const NOTE = 'هر انتخابت، یک تکه از دنیای تو رو کامل‌تر می‌کنه.';

/**
 * The artwork under the text: an animated WebP, the same treatment as the
 * Welcome hero. `unoptimized` because the image optimiser would hand back a
 * single still frame. The source is `assets/illustrations/onboarding-intro.webp`.
 */
const ARTWORK = {
  motion: '/images/brand/onboarding-intro.webp',
  still: '/images/brand/onboarding-intro-still.webp',
} as const;

const { props: artworkProps } = getImageProps({
  src: ARTWORK.motion,
  alt: '',
  width: 360,
  height: 202,
  priority: true,
  unoptimized: true,
});

/** Title, body, note — one after another, at the shared onboarding pace. */
const {
  starts: [TITLE_START, BODY_START, NOTE_START],
  endMs: ACTION_START,
} = streamSequence([
  { text: TITLE, stepMs: STREAM_PACE.titleStepMs },
  { text: BODY, stepMs: STREAM_PACE.bodyStepMs },
  { text: NOTE, stepMs: STREAM_PACE.noteStepMs },
]);

export function OnboardingIntro() {
  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader />

      <ScreenBody className="gap-8 pt-10 text-start">
        <div className="flex flex-col gap-4">
          <ScreenTitle
            title={
              <StreamedText text={TITLE} startMs={TITLE_START} stepMs={STREAM_PACE.titleStepMs} />
            }
          />
          <p className="text-base leading-relaxed text-foreground">
            <StreamedText text={BODY} startMs={BODY_START} stepMs={STREAM_PACE.bodyStepMs} />
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            <StreamedText text={NOTE} startMs={NOTE_START} stepMs={STREAM_PACE.noteStepMs} />
          </p>
        </div>

        {/* Arrives with the action, once the text has finished writing
            itself. Decorative — the text says everything — so `alt` is
            empty. Anyone who has asked for less movement gets the first
            frame: an animated image cannot be paused by `motion-reduce`. */}
        <picture
          className="block animate-in fade-in zoom-in-95 duration-500 fill-mode-backwards motion-reduce:animate-none"
          style={{ animationDelay: `${ACTION_START}ms` }}
        >
          <source media="(prefers-reduced-motion: reduce)" srcSet={ARTWORK.still} />
          <img {...artworkProps} alt="" className="h-auto w-full rounded-2xl" />
        </picture>
      </ScreenBody>

      {/* The footer's fill and its fade have to match the stage, or the
          action sits on a band of the app's usual background. */}
      <ScreenFooter className="bg-surface-stage/95 before:from-surface-stage">
        {/* A wrapper rather than the footer itself: `ScreenFooter` owns its
            `style` for the safe-area padding. */}
        <div className={ARRIVE_AFTER_STREAM} style={{ animationDelay: `${ACTION_START}ms` }}>
          <Button asChild size="xl" className="w-full">
            <Link href="/onboarding/interests">شروع ساخت دنیای من</Link>
          </Button>
        </div>
      </ScreenFooter>
    </Screen>
  );
}
