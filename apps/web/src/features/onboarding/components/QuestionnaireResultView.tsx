'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { QuestionnaireResult, ResultDimension } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

/**
 * The payoff — meaning first, numbers last.
 *
 * 1. What kind of profile this is: a short title and at most two sentences.
 * 2. What the product learned: three plain-language insights.
 * 3. Why it matters, and the way on.
 *
 * The five bars are there for whoever wants them, behind «جزئیات بیشتر».
 * Everything comes from `apps/api`, built from the person's own scores; none
 * of it is a fixed personality type, and no internal code ever appears. It
 * is a simplified reading — the full profile stays on the server for
 * matching.
 */

function DimensionBar({ dimension }: { dimension: ResultDimension }) {
  const valueText = `${toPersianDigits(Math.round(dimension.value))} از ۱۰`;
  const twoEnded = Boolean(dimension.minLabel && dimension.maxLabel);
  // 1 → the reading start, 10 → the far end. `inset-inline-*` keeps it right in RTL.
  const position = ((dimension.value - 1) / 9) * 100;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{dimension.label}</p>
      <div className="relative h-1 rounded-full bg-foreground/10" aria-hidden="true">
        {twoEnded ? (
          // A marker, not a fill: neither end of a two-ended scale is "more".
          <span
            className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-foreground"
            style={{ insetInlineStart: `calc(${position}% - 0.3125rem)` }}
          />
        ) : (
          <span
            className="absolute inset-y-0 start-0 rounded-full bg-foreground/60"
            style={{ width: `${(dimension.value / 10) * 100}%` }}
          />
        )}
      </div>
      {twoEnded && (
        <div aria-hidden="true" className="flex justify-between text-xs text-muted-foreground">
          <span>{dimension.minLabel}</span>
          <span>{dimension.maxLabel}</span>
        </div>
      )}
      <p className="sr-only">
        {twoEnded
          ? `${dimension.label}: ${valueText}، از ${dimension.minLabel} تا ${dimension.maxLabel}`
          : `${dimension.label}: ${valueText}`}
      </p>
    </div>
  );
}

export function QuestionnaireResultView({
  result,
  isLeaving,
  onContinue,
}: {
  result: QuestionnaireResult;
  isLeaving: boolean;
  onContinue: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const detailId = useId();

  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader />

      <ScreenBody className="gap-8 pb-4 pt-4 animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-primary">پروفایل اجتماعی تو</p>
          <ScreenTitle title={result.title} description={result.description} />
        </div>

        <dl className="flex flex-col gap-5">
          {result.insights.map((insight, index) => (
            <div
              key={insight.key}
              className="flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards motion-reduce:animate-none"
              style={{ animationDelay: `${200 + index * 80}ms` }}
            >
              <dt className="text-xs text-muted-foreground">{insight.label}</dt>
              <dd className="text-lg font-semibold">{insight.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="ghost"
            size="touch"
            aria-expanded={showDetail}
            aria-controls={detailId}
            onClick={() => setShowDetail((open) => !open)}
            className="-ms-3 w-fit font-normal text-muted-foreground hover:text-foreground"
          >
            جزئیات بیشتر
            <ChevronDown
              aria-hidden="true"
              className={cn('transition-transform duration-200 motion-reduce:transition-none', showDetail && 'rotate-180')}
            />
          </Button>

          {showDetail && (
            <div
              id={detailId}
              className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
            >
              {result.dimensions.map((dimension) => (
                <DimensionBar key={dimension.key} dimension={dimension} />
              ))}
            </div>
          )}
        </div>

        {/* Why the questionnaire was worth it — the last thing read before the action. */}
        <p className="mt-auto text-sm leading-relaxed text-muted-foreground">
          از این شناخت استفاده می‌کنیم تا آدم‌ها، گروه‌ها و تجربه‌هایی که بیشتر بهت می‌خورن رو پیشنهاد بدیم.
        </p>
      </ScreenBody>

      <ScreenFooter className="bg-surface-stage/95 before:from-surface-stage">
        <Button type="button" size="xl" className="w-full" loading={isLeaving} onClick={onContinue}>
          تجربه‌های من رو ببین
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
