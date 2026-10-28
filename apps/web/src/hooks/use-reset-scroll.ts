'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Back to the top whenever `step` changes.
 *
 * A flow that moves between screens by state rather than by URL — an
 * activity's questions, a journey's days, the questionnaire — stays on one
 * route, so Next's own scroll-on-navigation never runs and the next question
 * would open at the offset the last one was left at. One call per flow, with
 * a key naming the screen on show; anything that does not change the key
 * (picking an answer, an error appearing) leaves the scroll alone.
 *
 * Layout effect: the reset lands with the new screen's commit, before it is
 * painted, so the old offset is never seen. The first render does nothing —
 * arriving at the page is Next's scroll to handle, back/forward included.
 *
 * The scroller is the page, unless the flow is rendered inside a framed
 * scroller marked `data-scroll-root` (the admin's phone-sized preview).
 */
export function useResetScroll(step: string): void {
  const previous = useRef(step);

  useLayoutEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    const root = document.querySelector('[data-scroll-root]') ?? document.scrollingElement;
    root?.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);
}
