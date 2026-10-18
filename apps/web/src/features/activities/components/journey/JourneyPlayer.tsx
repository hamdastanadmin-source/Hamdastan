'use client';

import { useId, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { ENGAGEMENT_ERROR_CODES as CODES, type PlayerActivity } from '@hamdastan/types';
import { Button, Progress } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';
import { useAuthOptional } from '@/features/auth';
import { HttpError } from '@/services';

import { useJourneyPlayer, type JourneyPlayerOptions } from '../../hooks/use-journey-player';
import { QuestionField } from '../QuestionField';
import { QuestionImage } from '../QuestionImage';
import { DayCover } from './DayCover';
import { DayEndScreen } from './DayEndScreen';
import { DayReview } from './DayReview';
import { JourneyOverview } from './JourneyOverview';
import { MotionOverlay } from './MotionOverlay';
import { ResultScreen } from './ResultScreen';

const PROGRESS = 'h-0.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground';

/** Answers the API turned away because the journey moved on: the page is read again. */
const STALE = new Set<string>([
  CODES.JOURNEY_DAY_LOCKED,
  CODES.JOURNEY_ALREADY_ANSWERED,
  CODES.ACTIVITY_CLOSED,
  CODES.ACTIVITY_VERSION_CHANGED,
]);

/**
 * A multi-day journey, played: its timeline, a day's cover, its questions
 * one at a time — each answer saved as it is given — the motion after each,
 * the celebration at the day's end, and the day-end page with its
 * invitation. What is open, what was paid and when the next day opens are
 * the API's answers, never this screen's guesses.
 */
export function JourneyPlayer({ activity, preview }: { activity: PlayerActivity; preview?: JourneyPlayerOptions }) {
  const router = useRouter();
  const player = useJourneyPlayer(activity, preview);
  const name = useAuthOptional()?.firstName ?? null;
  const titleId = useId();
  const readable = useMemo(() => new Set(activity.steps.map((step) => step.id)), [activity.steps]);

  const submit = async () => {
    try {
      await player.submit();
    } catch (error) {
      if (error instanceof HttpError && error.code && STALE.has(error.code)) {
        toast.error(error.message);
        player.backToOverview();
        router.refresh();
        return;
      }
      // Sending the same answer again is safe: the API keeps the first one.
      toast.error(error instanceof HttpError ? error.message : 'ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.');
    }
  };

  const overlay = player.motion && (
    <MotionOverlay key={JSON.stringify(player.motion.playable)} playable={player.motion.playable} onDone={player.motionDone} />
  );

  // ─── The character card ─────────────────────────────────────────────────
  if (player.view === 'result' && player.journey.result) {
    return (
      <ResultScreen
        activity={activity}
        result={player.journey.result}
        media={player.media}
        name={name}
        onBack={player.backToOverview}
      />
    );
  }

  // ─── Day end ─────────────────────────────────────────────────────────────
  if (player.view === 'dayEnd' && player.dayEnd) {
    return (
      <>
        <DayEndScreen
          activity={activity}
          journey={player.journey}
          report={player.dayEnd}
          name={name}
          media={player.media}
          onResult={player.journey.result ? player.openResult : null}
          onDone={() => {
            player.backToOverview();
            router.refresh();
          }}
        />
        {overlay}
      </>
    );
  }

  // ─── A finished day, read back ──────────────────────────────────────────
  if (player.view === 'review' && player.day && player.dayState) {
    return <DayReview day={player.day} number={player.dayState.number} answers={player.answers} onBack={player.backToOverview} />;
  }

  // ─── A day's cover ──────────────────────────────────────────────────────
  if (player.view === 'cover' && player.day && player.dayState) {
    return (
      <DayCover
        day={player.day}
        number={player.dayState.number}
        started={player.dayState.answeredCount > 0}
        media={player.media}
        onBack={player.backToOverview}
        onStart={player.startDay}
      />
    );
  }

  // ─── A question ─────────────────────────────────────────────────────────
  if (player.view === 'question' && player.day && player.dayState && player.question) {
    const { day, dayState, question } = player;
    const image = question.imageId ? player.media[question.imageId] : undefined;
    return (
      <>
        <Screen>
          <ScreenHeader className="flex-col items-stretch gap-2 pb-2">
            <div className="flex items-center justify-between">
              <ScreenBack onClick={player.backToOverview} label="بازگشت به چالش" />
              <span className="text-xs tabular-nums text-muted-foreground">
                {/* No «·» beside Persian digits: it reads as a zero. */}
                روز {toPersianDigits(dayState.number)}، سؤال {toPersianDigits(player.index + 1)} از{' '}
                {toPersianDigits(day.questions.length)}
              </span>
            </div>
            <Progress value={(dayState.answeredCount / day.questions.length) * 100} className={PROGRESS} aria-label="پیشرفت روز" />
          </ScreenHeader>
          <ScreenBody className="gap-6 pt-6">
            {day.description && player.index === 0 && (
              <p className="text-sm leading-relaxed text-muted-foreground">{day.description}</p>
            )}
            {image && question.imagePosition !== 'below' && <QuestionImage key={image.id} media={image} />}
            <div id={titleId}>
              <ScreenTitle
                size="prompt"
                title={
                  <>
                    {question.title}
                    {!question.required && <span className="ms-2 text-sm font-normal text-muted-foreground">(اختیاری)</span>}
                  </>
                }
                description={question.description}
              />
            </div>
            {image && question.imagePosition === 'below' && <QuestionImage key={image.id} media={image} />}
            <QuestionField
              key={question.id}
              question={question}
              value={player.value}
              onChange={player.setValue}
              labelledBy={titleId}
              invalid={Boolean(player.error)}
            />
            {player.error && (
              <p role="alert" className="text-sm text-destructive">
                {player.error}
              </p>
            )}
          </ScreenBody>
          <ScreenFooter>
            <Button size="xl" className="w-full" onClick={submit} loading={player.busy} disabled={Boolean(player.motion)}>
              {!question.required && player.value === undefined ? 'رد شدن از این سؤال' : 'ثبت پاسخ'}
            </Button>
          </ScreenFooter>
        </Screen>
        {overlay}
      </>
    );
  }

  // ─── The timeline ───────────────────────────────────────────────────────
  return (
    <JourneyOverview
      activity={activity}
      journey={player.journey}
      readable={readable}
      onOpenDay={player.openDay}
      onOpenResult={player.journey.result ? player.openResult : null}
    />
  );
}
