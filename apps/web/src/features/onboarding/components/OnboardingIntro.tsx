import Link from 'next/link';

import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { StageArtwork } from './StageArtwork';
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
 * the owl follows it — part of the stage, not a clip on it (see
 * `StageArtwork`). The screen is `surface-stage` — black in the dark theme —
 * so the artwork is the only light on it.
 *
 * No header control: the only way on is the button, and stage 1 has its own
 * back to this screen.
 */

const TITLE = 'بیا دنیای تو رو بسازیم';
const BODY =
  'چند قدم کوتاه با هم پیش می‌ریم تا بیشتر بشناسیمت، علایقت رو بفهمیم و در نهایت آواتار شخصی تو رو در دنیای «هم‌داستان» بسازیم.';
const NOTE = 'هر انتخابت، یک تکه از دنیای تو رو کامل‌تر می‌کنه.';

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

        {/* It arrives with the action, once the text has finished. */}
        <StageArtwork name="onboarding-intro" delayMs={ACTION_START} />
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
