import { CircleCheck } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AssessmentResult, PlayerMedia } from '@hamdastan/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Progress, Separator } from '@hamdastan/ui';

import { BuiltinEffect } from './journey/BuiltinEffect';
import { QuestionImage } from './QuestionImage';

/** A neutral bar: figures are not the primary action. The dimension on top is drawn in full ink. */
const BAR = 'h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-foreground/40';
const TOP_BAR = 'h-2 bg-muted [&>[data-slot=progress-indicator]]:bg-foreground';

/**
 * A result's picture, large and centred. Just after submitting it pops in
 * under a sparkle; read back on the intro it simply sits there.
 */
export function ResultHero({ media, reveal }: { media: PlayerMedia; reveal: boolean }) {
  return (
    <div className="relative mx-auto w-3/5">
      {reveal && (
        <div className="pointer-events-none absolute -inset-8">
          <BuiltinEffect effect="sparkle" />
        </div>
      )}
      <QuestionImage media={media} className={cn('relative aspect-square max-h-none', reveal && 'motion-safe:animate-pop')} />
    </div>
  );
}

/**
 * An assessment's result as the person sees it, when the admin allowed it:
 * a knowledge score with its pass mark, the personality outcome and every
 * dimension's share, or the profile the person came out as — either with
 * its image, if it has one. A profile's weighted totals stay with the
 * admin: they can be negative and mean nothing on their own.
 */
export function ResultCard({
  result,
  media,
  heading,
  reveal = false,
}: {
  result: AssessmentResult;
  media: Record<string, PlayerMedia>;
  /** A personality result's line above its title — `resultHeading`. */
  heading: string;
  /** The done screen, just after submitting: the outcome is revealed, not read back. */
  reveal?: boolean;
}) {
  if (result.mode === 'knowledge') {
    const score = result.score ?? 0;
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <CardDescription className="text-center">نمره‌ی تو</CardDescription>
          <CardTitle className={cn('text-center text-5xl font-bold tabular-nums', reveal && 'motion-safe:animate-pop')}>
            {toPersianDigits(score)}٪
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Progress value={score} className={TOP_BAR} aria-label="نمره" />
          {result.passed !== null &&
            (result.passed ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                <CircleCheck aria-hidden="true" className="size-4" />
                قبول شدی!
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">این بار به نمره‌ی قبولی نرسیدی.</p>
            ))}
        </CardContent>
      </Card>
    );
  }

  const outcome = result.outcome;
  const image = outcome?.imageId ? media[outcome.imageId] : undefined;
  return (
    <Card>
      <CardHeader className="items-center gap-2 space-y-0 text-center">
        {image && (
          <div className="mb-3 w-full">
            <ResultHero media={image} reveal={reveal} />
          </div>
        )}
        <CardDescription className="text-center">{result.mode === 'profile' ? 'پروفایل تو' : heading}</CardDescription>
        <CardTitle className="text-center text-2xl font-bold leading-snug">{outcome?.title ?? '—'}</CardTitle>
        {outcome?.description && (
          <p className="whitespace-pre-line text-base leading-relaxed text-muted-foreground">{outcome.description}</p>
        )}
      </CardHeader>
      {result.dimensions.length > 0 && (
        <CardContent className="flex flex-col gap-4">
          <Separator />
          <p className="text-sm font-semibold">سهم هر بُعد</p>
          <ul className="flex flex-col gap-3">
            {result.dimensions.map((dimension) => {
              const top = dimension.title === outcome?.title;
              return (
                <li key={dimension.id} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-sm">
                    <span className={cn(top && 'font-semibold')}>{dimension.title}</span>
                    <span className={cn('tabular-nums', top ? 'font-semibold' : 'text-muted-foreground')}>
                      {toPersianDigits(dimension.value)}٪
                    </span>
                  </div>
                  <Progress value={dimension.value} className={top ? TOP_BAR : BAR} aria-label={dimension.title} />
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}
