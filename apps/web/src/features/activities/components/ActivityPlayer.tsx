'use client';

import { useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleCheck, Clock, Hourglass, Lock } from 'lucide-react';
import { toast } from 'sonner';

import { ACTIVITY_TYPE_LABELS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { ENGAGEMENT_ERROR_CODES, type PlayerActivity } from '@hamdastan/types';
import { Badge, Button, IconBadge, Progress } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle, XpAmount } from '@/components';
import { RewardChip } from '@/features/profile';
import { HttpError } from '@/services';

import { useActivityPlayer } from '../hooks/use-activity-player';
import { minutesLabel, STATUS_LABELS } from '../utils/activity';
import { QuestionField } from './QuestionField';
import { ResultCard } from './ResultCard';

/** The progress line in foreground — progress is not the primary action. */
const PROGRESS = 'h-0.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground';

/**
 * Playing an activity: the intro, one question per screen, and what came
 * of it.
 *
 * The done screen reports the API's answer and nothing else: «XP گرفتی»
 * appears only when the response says XP was written to the ledger, and a
 * mission waiting for review says so instead.
 */
export function ActivityPlayer({ activity }: { activity: PlayerActivity }) {
  const router = useRouter();
  const player = useActivityPlayer(activity);
  const titleId = useId();

  const next = async () => {
    try {
      await player.next();
    } catch (error) {
      if (error instanceof HttpError && error.code === ENGAGEMENT_ERROR_CODES.ACTIVITY_VERSION_CHANGED) {
        toast.error(error.message);
        router.refresh();
        return;
      }
      toast.error(error instanceof HttpError ? error.message : 'ارتباط با سرور برقرار نشد. دوباره امتحان کن.');
    }
  };

  // ─── Done ────────────────────────────────────────────────────────────────
  if (player.phase === 'done' && player.outcome) {
    const { outcome } = player;
    const waiting = outcome.status === 'pending_review';
    return (
      <Screen>
        <ScreenHeader />
        <ScreenBody center className="gap-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <IconBadge tone="muted" size="lg">
              {waiting ? <Hourglass aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
            </IconBadge>
            <ScreenTitle
              title={waiting ? 'ثبت شد؛ در انتظار تأیید' : 'آفرین، ثبت شد!'}
              description={
                waiting
                  ? 'مدرکت برای بررسی فرستاده شد. بعد از تأیید، XP این مأموریت به حسابت اضافه می‌شه.'
                  : activity.anonymous
                    ? 'پاسخت بدون نام ثبت شد.'
                    : 'ممنون که وقت گذاشتی.'
              }
            />
            {outcome.xpAwarded > 0 && (
              <p className="flex flex-col items-center gap-1" role="status">
                <span className="text-2xl font-bold text-success">
                  <XpAmount value={outcome.xpAwarded} signed />
                </span>
                <span className="text-sm text-muted-foreground">
                  گرفتی — موجودی‌ات حالا <XpAmount value={outcome.xpTotal} />
                </span>
              </p>
            )}
          </div>
          {outcome.result && <ResultCard result={outcome.result} />}
        </ScreenBody>
        <ScreenFooter>
          <Button asChild size="xl" className="w-full">
            <Link href="/">بازگشت به خانه</Link>
          </Button>
        </ScreenFooter>
      </Screen>
    );
  }

  // ─── A question ──────────────────────────────────────────────────────────
  if (player.phase === 'question' && player.current) {
    const { question, step } = player.current;
    const showStep = activity.steps.length > 1 && step.title;
    return (
      <Screen>
        <ScreenHeader className="flex-col items-stretch gap-2 pb-2">
          <div className="flex items-center justify-between">
            <ScreenBack onClick={player.back} label="قبلی" />
            <span className="text-xs tabular-nums text-muted-foreground">
              {toPersianDigits(player.index + 1)} از {toPersianDigits(player.flow.length)}
            </span>
          </div>
          <Progress value={player.progress} className={PROGRESS} aria-label="پیشرفت" />
        </ScreenHeader>
        <ScreenBody className="gap-6 pt-6">
          {showStep && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted-foreground">
                مرحله‌ی {toPersianDigits(player.current.stepIndex + 1)}: {step.title}
              </p>
              {step.description && player.current.step.questions[0]?.id === question.id && (
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              )}
            </div>
          )}
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
          <QuestionField
            key={question.id}
            question={question}
            value={player.answers[question.id]}
            onChange={player.setAnswer}
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
          <Button size="xl" className="w-full" onClick={next} loading={player.submitting}>
            {player.isLast ? 'ثبت نهایی' : 'بعدی'}
          </Button>
        </ScreenFooter>
      </Screen>
    );
  }

  // ─── Intro ───────────────────────────────────────────────────────────────
  const waiting = activity.status === 'pending_review';
  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/activities" />
      </ScreenHeader>
      <ScreenBody className="gap-6 pt-2">
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
          <span>{toPersianDigits(player.flow.length)} سؤال</span>
        </div>
        {activity.instructions && (
          <p className="whitespace-pre-line text-base leading-relaxed">{activity.instructions}</p>
        )}
        {activity.anonymous && (
          <p className="flex items-start gap-2 rounded-xl border p-3 text-sm text-muted-foreground">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            پاسخ‌هات ناشناس ثبت می‌شه؛ هیچ گزارشی اسمت رو کنار جواب‌هات نمی‌ذاره.
          </p>
        )}
        {activity.review === 'manual' && (
          <p className="text-sm text-muted-foreground">بعد از ثبت، انجامش بررسی و تأیید می‌شه و XP بعد از تأیید میاد.</p>
        )}
        {activity.lastResult && <ResultCard result={activity.lastResult} />}
      </ScreenBody>
      <ScreenFooter>
        {activity.canSubmit ? (
          <Button size="xl" className="w-full" onClick={player.start}>
            {player.hasDraft ? 'ادامه' : activity.submissions > 0 ? 'انجام دوباره' : 'شروع'}
          </Button>
        ) : (
          <Button size="xl" className="w-full" variant="outline" disabled>
            {waiting
              ? 'در انتظار تأیید'
              : activity.status === 'completed'
                ? 'انجامش دادی'
                : 'این فعالیت الان باز نیست'}
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
