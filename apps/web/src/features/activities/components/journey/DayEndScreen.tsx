'use client';

import { CalendarClock, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { PlayerActivity, PlayerJourney, PlayerMedia } from '@hamdastan/types';
import { Button, Progress } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, XpAmount } from '@/components';

import type { DayEndReport } from '../../hooks/use-journey-player';
import { fillTemplate, inviteUrl, opensLabel } from '../../utils/journey';
import { shareInvite } from '../../utils/share';
import { MotionDisplay } from './MotionDisplay';

/** The progress line in foreground — progress is not the primary action. */
const PROGRESS = 'h-1.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground';

/**
 * After a day's last answer: the admin's congratulations, made personal;
 * how far the person has come; what the day paid (the ledger's figure);
 * when the next day opens; and the invitation — the system's share sheet,
 * or the link copied.
 */
export function DayEndScreen({
  activity,
  journey,
  report,
  name,
  media,
  onResult,
  onDone,
}: {
  activity: PlayerActivity;
  journey: PlayerJourney;
  report: DayEndReport;
  name: string | null;
  media: Record<string, PlayerMedia>;
  /** The journey is finished and has a character card: its page. */
  onResult: (() => void) | null;
  onDone: () => void;
}) {
  const { dayEnd } = journey;
  const total = journey.days.length;
  const values = { name, day: report.dayNumber, days: total };
  const invite = dayEnd.invite.enabled;

  const share = async () => {
    const outcome = await shareInvite({
      title: activity.title,
      text: dayEnd.invite.shareMessage,
      url: inviteUrl(activity.id, window.location.origin),
    });
    if (outcome === 'copied') toast.success('لینک دعوت کپی شد');
    if (outcome === 'failed') toast.error('اشتراک‌گذاری ممکن نشد؛ لینک این صفحه رو برای دوستات بفرست.');
  };

  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody className="items-center gap-6 pt-2 text-center">
        <MotionDisplay setting={dayEnd.mascot} media={media} className="aspect-square w-full max-w-52" />
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-snug">
            {report.journeyCompleted ? 'همه‌ی روزها رو تموم کردی!' : fillTemplate(dayEnd.title, values)}
          </h1>
          {dayEnd.message && !report.journeyCompleted && (
            <p className="text-base leading-relaxed text-muted-foreground">{fillTemplate(dayEnd.message, values)}</p>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 rounded-2xl border p-4 text-start">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {toPersianDigits(journey.completedDays)} از {toPersianDigits(total)} روز
            </span>
            {report.xpToday > 0 && (
              <span className="font-bold text-success">
                <XpAmount value={report.xpToday} signed /> امروز
              </span>
            )}
          </div>
          <Progress value={(journey.completedDays / total) * 100} className={PROGRESS} aria-label="روزهای تکمیل‌شده" />
          {!report.journeyCompleted && journey.nextUnlockAt && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
              مرحله‌ی بعد {opensLabel(journey.nextUnlockAt)} باز می‌شه — برگرد تا راز بعدی رو کشف کنیم!
            </p>
          )}
        </div>

        {invite && dayEnd.invite.text && (
          <p className="text-sm leading-relaxed text-muted-foreground">{dayEnd.invite.text}</p>
        )}
      </ScreenBody>
      <ScreenFooter className="flex flex-col gap-2">
        {report.journeyCompleted && onResult ? (
          <>
            <Button size="xl" className="w-full" onClick={onResult}>
              <Sparkles aria-hidden="true" />
              دیدن شخصیت تو
            </Button>
            {invite && (
              <Button size="xl" variant="ghost" className="w-full" onClick={share}>
                <Share2 aria-hidden="true" />
                {dayEnd.invite.button}
              </Button>
            )}
          </>
        ) : invite ? (
          <>
            <Button size="xl" className="w-full" onClick={share}>
              <Share2 aria-hidden="true" />
              {dayEnd.invite.button}
            </Button>
            <Button size="xl" variant="ghost" className="w-full" onClick={onDone}>
              بازگشت به چالش
            </Button>
          </>
        ) : (
          <Button size="xl" className="w-full" onClick={onDone}>
            بازگشت به چالش
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
