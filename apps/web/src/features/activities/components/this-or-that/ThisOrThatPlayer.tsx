'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Clock, Images } from 'lucide-react';
import { toast } from 'sonner';

import { ACTIVITY_TYPE_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { ENGAGEMENT_ERROR_CODES, type PlayerActivity } from '@hamdastan/types';
import { Badge, Button, Progress } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle, XpAmount } from '@/components';
import { RewardChip } from '@/features/profile';
import { useResetScroll } from '@/hooks';
import { HttpError } from '@/services';

import { useThisOrThat } from '../../hooks/use-this-or-that';
import { minutesLabel, PROGRESS_LINE, STATUS_LABELS } from '../../utils/activity';
import type { ActivityExit } from '../../utils/exit';
import { cardLabel } from '../../utils/this-or-that';
import { BuiltinEffect } from '../journey/BuiltinEffect';
import { MediaView } from '../journey/MediaView';
import { DuelCard } from './DuelCard';

/**
 * «این یا اون»: the intro, then two cards at a time — tap one, it wins and
 * stays for the next — and the one left at the end, with «اتمام فعالیت».
 * What the run earns is the API's answer, shown as it comes back.
 */
export function ThisOrThatPlayer({ activity, exit }: { activity: PlayerActivity; exit?: ActivityExit }) {
  const router = useRouter();
  const game = useThisOrThat(activity);
  useResetScroll(`${game.phase}:${game.round}`);
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = activity.thisOrThat?.coverImageId ? activity.media[activity.thisOrThat.coverImageId] : undefined;

  const finish = async () => {
    try {
      await game.finish();
    } catch (error) {
      if (error instanceof HttpError && error.code === ENGAGEMENT_ERROR_CODES.ACTIVITY_VERSION_CHANGED) {
        toast.error(error.message);
        router.refresh();
        return;
      }
      toast.error(error instanceof HttpError ? error.message : 'ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.');
    }
  };

  // ─── The pick ────────────────────────────────────────────────────────────
  if (game.phase === 'final' && game.winner) {
    const { winner, outcome } = game;
    const media = activity.media[winner.imageId];
    return (
      <Screen>
        <ScreenHeader>{!outcome && <ScreenBack onClick={game.back} label="قبلی" />}</ScreenHeader>
        <ScreenBody center className="items-center gap-6 text-center">
          <div className="relative w-3/5">
            <div className="pointer-events-none absolute -inset-8">
              <BuiltinEffect effect="sparkle" />
            </div>
            <div className="relative aspect-3/4 w-full overflow-hidden rounded-3xl border-2 border-foreground bg-foreground/5 shadow-lg motion-safe:animate-pop">
              {media && <MediaView media={media} fill alt={cardLabel(game.cards, winner)} />}
            </div>
          </div>
          <ScreenTitle
            title={winner.title || 'انتخاب نهایی تو'}
            description={`از بین ${toPersianDigits(game.cards.length)} تصویر، این یکی انتخاب نهایی توئه.`}
          />
          {outcome && outcome.xpAwarded > 0 && (
            <p className="flex flex-col items-center gap-1" role="status">
              <span className="text-2xl font-bold text-success">
                <XpAmount value={outcome.xpAwarded} signed />
              </span>
              <span className="text-sm text-muted-foreground">
                گرفتی — موجودی‌ات حالا <XpAmount value={outcome.xpTotal} />
              </span>
            </p>
          )}
        </ScreenBody>
        <ScreenFooter>
          {outcome ? (
            <Button asChild size="xl" className="w-full">
              <Link href={exit?.href ?? '/'}>{exit?.label ?? 'بازگشت به خانه'}</Link>
            </Button>
          ) : (
            <Button size="xl" className="w-full" onClick={finish} loading={game.submitting}>
              اتمام فعالیت
            </Button>
          )}
        </ScreenFooter>
      </Screen>
    );
  }

  // ─── A match ─────────────────────────────────────────────────────────────
  if (game.phase === 'play' && game.pair) {
    return (
      <Screen>
        <ScreenHeader className="flex-col items-stretch gap-2 pb-2">
          <div className="flex items-center justify-between">
            <ScreenBack onClick={game.back} label="قبلی" />
            <span className="text-xs tabular-nums text-muted-foreground">
              {toPersianDigits(game.round)} از {toPersianDigits(game.rounds)}
            </span>
          </div>
          <Progress value={game.progress} className={PROGRESS_LINE} aria-label="پیشرفت" />
        </ScreenHeader>
        <ScreenBody center className="gap-6">
          <ScreenTitle size="prompt" title="این یا اون؟" description="روی تصویری که بیشتر دوست داری بزن." />
          <div className="relative grid grid-cols-2 gap-4">
            {game.pair.map((card) => (
              <DuelCard
                key={card.id}
                media={activity.media[card.imageId]}
                label={cardLabel(game.cards, card)}
                title={card.title}
                state={game.picked === null ? 'idle' : game.picked === card.id ? 'won' : 'lost'}
                disabled={game.picked !== null}
                onPick={() => game.pick(card.id)}
              />
            ))}
            {/* Over the images only: bottom-12 leaves out the titles under them (min-h-10 + the gap). */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 bottom-12 flex items-center justify-center">
              <span
                className={cn(
                  // Violet by product decision: the duel's mark, like onboarding's picks.
                  'flex size-12 items-center justify-center rounded-full border-4 border-background bg-primary text-sm font-extrabold text-primary-foreground shadow-md transition-[scale,opacity] duration-200 motion-reduce:transition-none',
                  game.picked !== null && 'scale-50 opacity-0'
                )}
              >
                VS
              </span>
            </div>
          </div>
        </ScreenBody>
      </Screen>
    );
  }

  // ─── Intro ───────────────────────────────────────────────────────────────
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href={exit?.href ?? '/activities'} label={exit?.label} />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-2">
        {cover && !coverFailed && (
          <div className="aspect-video w-full overflow-hidden rounded-2xl bg-foreground/5">
            <MediaView media={cover} fill onError={() => setCoverFailed(true)} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{ACTIVITY_TYPE_LABELS[activity.type]}</Badge>
          {activity.status !== 'not_started' && <Badge variant="secondary">{STATUS_LABELS[activity.status]}</Badge>}
        </div>
        <ScreenTitle title={activity.title} description={activity.summary} />
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock aria-hidden="true" className="size-4" />
            {minutesLabel(activity.estimatedMinutes)}
          </span>
          {activity.xp !== null && <RewardChip xp={activity.xp} />}
          <span className="inline-flex items-center gap-1.5">
            <Images aria-hidden="true" className="size-4" />
            {toPersianDigits(game.cards.length)} تصویر
          </span>
        </div>
        {activity.instructions && <p className="whitespace-pre-line text-base leading-relaxed">{activity.instructions}</p>}
        <p className="rounded-xl border p-3 text-sm leading-relaxed text-muted-foreground">
          هر بار دو تصویر می‌بینی و یکی رو انتخاب می‌کنی؛ برنده می‌مونه و با تصویر بعدی رقابت می‌کنه تا انتخاب نهایی‌ات
          مشخص بشه.
        </p>
      </ScreenBody>
      <ScreenFooter>
        {activity.canSubmit ? (
          <Button size="xl" className="w-full" onClick={game.start}>
            {game.hasDraft ? 'ادامه' : 'شروع'}
          </Button>
        ) : (
          <Button size="xl" className="w-full" variant="outline" disabled>
            {activity.status === 'completed' ? 'انجامش دادی' : 'این فعالیت الان باز نیست'}
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
