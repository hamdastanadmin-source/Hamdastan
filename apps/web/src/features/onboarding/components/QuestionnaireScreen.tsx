'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { cn } from '@hamdastan/shared/cn';
import { Progress } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

/**
 * The frame every questionnaire screen shares, and the reason they all feel
 * like one calm conversation rather than a stack of forms.
 *
 * - **Surface.** `surface-stage` — near-black in the dark theme, plain white
 *   in the light one — the same surface as the onboarding intro. Colour is
 *   left to the few things that earn it: the selected answer, the filled part
 *   of the bar, the primary action.
 * - **Order.** A quiet header with back, a thin progress line that says
 *   «داریم بیشتر می‌شناسیمت» and never a count, then the content, a fixed
 *   distance below. There is no way out but back: the choice to do this
 *   later is offered once, on the intro, before the journey starts; once in,
 *   the person goes to the end (every answer is still saved as it is given,
 *   so a closed tab resumes where it left off).
 *   Top-aligned rather than centred: a question sits in the same place on
 *   every screen and every phone, high where the eye already is, instead of
 *   drifting down with the screen's height and the length of its answers.
 * - **Motion.** The content arrives with a short fade and rise (200ms) and,
 *   when `leaving`, departs with a shorter fade and lift (150ms); the header
 *   and the bar stay put, and the bar eases to its new width. Nothing moves
 *   with reduced motion.
 *
 * Focus moves to the content on arrival: a single-choice answer advances by
 * itself, which unmounts the control that had focus.
 */

const PROGRESS_LABEL = 'داریم بیشتر می‌شناسیمت';

export function QuestionnaireScreen({
  progress,
  onBack,
  footer,
  leaving = false,
  children,
}: {
  progress: number;
  onBack?: () => void;
  footer?: ReactNode;
  leaving?: boolean;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader>
        {onBack && <ScreenBack onClick={onBack} />}
      </ScreenHeader>

      <ScreenBody className="pb-4">
        <div className="flex flex-col gap-2">
          <p className="text-2xs text-muted-foreground">{PROGRESS_LABEL}</p>
          <Progress
            value={progress}
            aria-label={PROGRESS_LABEL}
            className="h-0.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:duration-500 [&>[data-slot=progress-indicator]]:ease-out"
          />
        </div>

        <div
          ref={contentRef}
          tabIndex={-1}
          className={cn(
            'flex flex-col gap-6 pt-10 outline-none',
            leaving
              ? 'animate-out fade-out slide-out-to-top-1 duration-150 ease-in fill-mode-forwards'
              : 'animate-in fade-in slide-in-from-bottom-1 duration-200 ease-out',
            'motion-reduce:animate-none'
          )}
        >
          {children}
        </div>
      </ScreenBody>

      {footer && (
        <ScreenFooter className="bg-surface-stage/95 before:from-surface-stage">{footer}</ScreenFooter>
      )}
    </Screen>
  );
}
