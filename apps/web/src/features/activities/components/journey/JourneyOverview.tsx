'use client';

import { useRouter } from 'next/navigation';
import { CircleCheck, CircleDashed, Hourglass, Lock, Play, Sparkles } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { PlayerActivity, PlayerJourney, PlayerJourneyDay } from '@hamdastan/types';
import { Badge, Button, Progress } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle, XpAmount } from '@/components';
import { RewardChip } from '@/features/profile';

import { useClock } from '../../hooks/use-clock';
import { countdownLabel, opensLabel } from '../../utils/journey';

const PROGRESS = 'h-1.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground';

/** What a day's row says about it, by the API's status. */
function dayNote(day: PlayerJourneyDay, now: Date): { icon: typeof Lock; text: string } {
  switch (day.status) {
    case 'completed':
      return { icon: CircleCheck, text: 'انجام شد' };
    case 'in_progress':
      return { icon: Play, text: `ادامه، ${toPersianDigits(day.answeredCount)} از ${toPersianDigits(day.questionCount)}` };
    case 'available':
      return { icon: Play, text: 'آماده‌ی شروع' };
    case 'missed':
      return { icon: CircleDashed, text: 'ازدست‌رفته' };
    case 'locked':
      if (day.lockReason === 'previous_day') return { icon: Lock, text: 'بعد از تکمیل روز قبل' };
      return { icon: Lock, text: day.unlocksAt ? `${opensLabel(day.unlocksAt, now)} باز می‌شه` : 'قفل' };
  }
}

/**
 * A journey's home: how far the person has come, every day with what it is
 * now — and the one action, the day to play. With none open, the time the
 * next one opens counts down; when it passes, the API is asked again. A
 * locked day is a number and a time, nothing more.
 */
export function JourneyOverview({
  activity,
  journey,
  readable,
  onOpenDay,
  onOpenResult,
}: {
  activity: PlayerActivity;
  journey: PlayerJourney;
  /** Days whose content the API sent: the ones that can be opened. */
  readable: Set<string>;
  onOpenDay: (id: string) => void;
  /** A finished journey's character card, when it has one. */
  onOpenResult: (() => void) | null;
}) {
  const router = useRouter();
  const now = useClock(journey.nextUnlockAt, () => router.refresh());
  const total = journey.days.length;
  const current = journey.days.find((day) => day.status === 'in_progress' || day.status === 'available');
  const finished = journey.completedAt !== null;
  const countdown = journey.nextUnlockAt ? countdownLabel(journey.nextUnlockAt, now) : null;

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/activities" />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">چالش {toPersianDigits(total)} روزه</Badge>
          {activity.xp !== null && <RewardChip xp={activity.xp} />}
        </div>
        <ScreenTitle title={activity.title} description={activity.summary} />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {toPersianDigits(journey.completedDays)} از {toPersianDigits(total)} روز
            </span>
            {finished && <span className="text-success">تموم شد</span>}
          </div>
          <Progress value={(journey.completedDays / total) * 100} className={PROGRESS} aria-label="پیشرفت چالش" />
        </div>

        {activity.instructions && journey.completedDays === 0 && (
          <p className="whitespace-pre-line text-base leading-relaxed">{activity.instructions}</p>
        )}

        <ol className="flex flex-col gap-2" aria-label="روزها">
          {journey.days.map((day) => {
            const note = dayNote(day, now);
            const Icon = note.icon;
            const open = readable.has(day.id);
            const body = (
              <>
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums',
                    day.status === 'completed' && 'border-foreground bg-foreground text-background'
                  )}
                >
                  {toPersianDigits(day.number)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-start">
                  <span className={cn('truncate font-medium', !open && 'text-muted-foreground')}>
                    {day.title ?? `روز ${toPersianDigits(day.number)}`}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
                    {note.text}
                  </span>
                </span>
                {day.status === 'completed' && day.xpEarned > 0 && (
                  <span className="text-sm font-semibold text-success">
                    <XpAmount value={day.xpEarned} signed />
                  </span>
                )}
              </>
            );
            return (
              <li key={day.id}>
                {open ? (
                  <button
                    type="button"
                    onClick={() => onOpenDay(day.id)}
                    className="flex w-full items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-current={current?.id === day.id ? 'step' : undefined}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </ScreenBody>
      <ScreenFooter>
        {finished && onOpenResult ? (
          <Button size="xl" className="w-full" onClick={onOpenResult}>
            <Sparkles aria-hidden="true" />
            کارت شخصیت من
          </Button>
        ) : current && activity.canSubmit ? (
          <Button size="xl" className="w-full" onClick={() => onOpenDay(current.id)}>
            {current.status === 'in_progress' ? 'ادامه‌ی' : 'شروع'} روز {toPersianDigits(current.number)}
          </Button>
        ) : (
          <Button size="xl" variant="outline" className="w-full" disabled>
            {finished ? (
              'همه‌ی روزها رو تموم کردی'
            ) : countdown ? (
              <>
                <Hourglass aria-hidden="true" />
                روز بعد تا {countdown} دیگه باز می‌شه
              </>
            ) : activity.canSubmit ? (
              'منتظر باز شدن روز بعد باش'
            ) : (
              'این چالش الان باز نیست'
            )}
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
