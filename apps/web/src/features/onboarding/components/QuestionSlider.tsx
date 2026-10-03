'use client';

import { useEffect, useRef, useState } from 'react';

import { SLIDER_MAX, SLIDER_MIN, type SliderQuestion } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { Slider } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * A 1–10 scale that reads as a feeling rather than a number.
 *
 * The two ends carry the meaning — «خیلی خسته می‌شم … انرژی می‌گیرم» — and
 * the number only appears while the thumb is being moved and for a moment
 * after, in a small label riding above it. The label is a child of the thumb
 * itself, so it is centred over it by layout alone: no position is computed,
 * and nothing can put it anywhere else. The track is neutral; the thumb is
 * the clear thing to grab (24px, inside a padded band so the whole strip
 * takes a tap), and turns to the accent once the person has chosen.
 *
 * 1 sits at the reading start — the right, in RTL — which is where Radix puts
 * the minimum under the app's `DirectionProvider`; the labels follow suit.
 * The scale and its values are exactly the 1–10 the scoring reads.
 */

/** How long the number stays after the last movement. */
const VALUE_LINGER_MS = 900;

export function QuestionSlider({
  question,
  value,
  touched,
  onChange,
  labelledBy,
}: {
  question: SliderQuestion;
  value: number;
  touched: boolean;
  onChange: (value: number) => void;
  labelledBy: string;
}) {
  const [showValue, setShowValue] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const reveal = () => {
    setShowValue(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowValue(false), VALUE_LINGER_MS);
  };

  const valueText = `${toPersianDigits(value)} از ${toPersianDigits(SLIDER_MAX)}`;

  return (
    <div className="flex flex-col gap-3 pt-8">
      <Slider
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={1}
        value={[value]}
        onValueChange={([next]) => {
          onChange(next);
          reveal();
        }}
        // A tap on the thumb without moving it is still a choice of this value.
        onPointerDown={() => {
          onChange(value);
          reveal();
        }}
        className="py-5"
        trackClassName="bg-foreground/10 data-[orientation=horizontal]:h-1"
        rangeClassName="bg-foreground/35"
        thumbClassName={cn('relative size-6 border-2 shadow-md', touched ? 'border-primary' : 'border-foreground/20')}
        thumbProps={{
          'aria-labelledby': labelledBy,
          'aria-valuetext': valueText,
          children: (
            // Centred over the thumb by layout alone: a strip as wide as the
            // thumb, sitting on top of it, centres the label with flex — which,
            // unlike auto margins, still centres a child wider than the strip.
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-full mb-2 flex justify-center">
              <span
                className={cn(
                  'w-9 shrink-0 rounded-md bg-foreground py-0.5 text-center text-sm font-semibold tabular-nums text-background transition-opacity duration-150',
                  showValue ? 'opacity-100' : 'opacity-0'
                )}
              >
                {toPersianDigits(value)}
              </span>
            </span>
          ),
        }}
      />

      <div aria-hidden="true" className="flex justify-between gap-6 text-xs leading-relaxed text-muted-foreground">
        <span>{question.minLabel}</span>
        <span className="text-end">{question.maxLabel}</span>
      </div>

      {/* The ends, for a screen reader: the visible labels are hidden above
          because they would be read as two loose phrases. */}
      <p className="sr-only">
        {`${toPersianDigits(SLIDER_MIN)} یعنی ${question.minLabel} و ${toPersianDigits(SLIDER_MAX)} یعنی ${question.maxLabel}`}
      </p>
    </div>
  );
}
