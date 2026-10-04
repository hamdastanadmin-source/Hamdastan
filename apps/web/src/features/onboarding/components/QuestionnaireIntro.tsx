import { Clock } from 'lucide-react';

import { QUESTIONNAIRE_DURATION_LABEL } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { SectionMark } from './SectionMark';
import { StageArtwork } from './StageArtwork';
import { ARRIVE_AFTER_STREAM, STREAM_PACE, StreamedText, streamSequence } from './StreamedText';

/**
 * The questionnaire's door. It frames what follows as getting to know the
 * person — never as a test, and never with a question count. The only
 * number is the time it takes. The four empty dots are the four short
 * chapters ahead; each fills as one ends.
 *
 * On a first visit the text writes itself in a word at a time, at the same
 * pace as the onboarding intro, and the actions arrive once it has finished.
 * `stream` is off when the person comes back here from a question: reading
 * the same lines being typed out again is only a wait. With reduced motion
 * it is all there at once either way.
 *
 * Under the text, the owl — part of the stage, not a clip on it (see
 * `StageArtwork`).
 *
 * «بعداً انجام می‌دم» leaves without starting and goes home; nothing is
 * lost, and home and the profile offer the questionnaire as a mission until
 * it is done.
 */

const TITLE = 'ترجیحات شما را بهتر بشناسیم';
const BODY = 'چند انتخاب کوتاه داریم تا بفهمیم چه آدم‌ها، گروه‌ها و تجربه‌هایی بیشتر بهت می‌خورن.';
const NOTE = 'جواب درست یا غلطی وجود نداره؛ فقط چیزی رو انتخاب کن که بیشتر شبیه خودته.';
const DURATION = QUESTIONNAIRE_DURATION_LABEL;

const {
  starts: [TITLE_START, BODY_START, NOTE_START, DURATION_START],
  endMs: ACTION_START,
} = streamSequence([
  { text: TITLE, stepMs: STREAM_PACE.titleStepMs },
  { text: BODY, stepMs: STREAM_PACE.bodyStepMs },
  { text: NOTE, stepMs: STREAM_PACE.noteStepMs },
  { text: DURATION, stepMs: STREAM_PACE.noteStepMs },
]);

export function QuestionnaireIntro({
  stream,
  backHref,
  isLeaving,
  onStart,
  onLater,
}: {
  stream: boolean;
  backHref: string;
  /** «بعداً» is finishing onboarding on its way out. */
  isLeaving: boolean;
  onStart: () => void;
  onLater: () => void;
}) {
  const text = (value: string, startMs: number, stepMs: number) =>
    stream ? <StreamedText text={value} startMs={startMs} stepMs={stepMs} /> : value;

  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader>
        <ScreenBack href={backHref} />
      </ScreenHeader>

      <ScreenBody className="gap-5">
        <SectionMark reached={0} />

        <ScreenTitle
          title={text(TITLE, TITLE_START, STREAM_PACE.titleStepMs)}
          description={text(BODY, BODY_START, STREAM_PACE.bodyStepMs)}
        />

        <p className="text-sm leading-relaxed text-muted-foreground">
          {text(NOTE, NOTE_START, STREAM_PACE.noteStepMs)}
        </p>

        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          {/* The icon arrives with its words, not before them. */}
          <Clock
            aria-hidden="true"
            className={stream ? 'size-3.5 animate-in fade-in duration-300 fill-mode-backwards motion-reduce:animate-none' : 'size-3.5'}
            style={stream ? { animationDelay: `${DURATION_START}ms` } : undefined}
          />
          <span>{text(DURATION, DURATION_START, STREAM_PACE.noteStepMs)}</span>
        </p>

        {/* It arrives with the actions, once the text has finished. */}
        <StageArtwork name="questionnaire-intro" fadeIn={stream} delayMs={ACTION_START} />
      </ScreenBody>

      <ScreenFooter className="bg-surface-stage/95 before:from-surface-stage">
        {/* A wrapper rather than the footer itself: `ScreenFooter` owns its
            `style` for the safe-area padding. */}
        <div
          className={stream ? `flex flex-col gap-1 ${ARRIVE_AFTER_STREAM}` : 'flex flex-col gap-1'}
          style={stream ? { animationDelay: `${ACTION_START}ms` } : undefined}
        >
          <Button type="button" size="xl" className="w-full" onClick={onStart}>
            شروع کنیم
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="touch"
            className="w-full font-normal text-muted-foreground hover:text-foreground"
            loading={isLeaving}
            onClick={onLater}
          >
            بعداً انجام می‌دم
          </Button>
        </div>
      </ScreenFooter>
    </Screen>
  );
}
