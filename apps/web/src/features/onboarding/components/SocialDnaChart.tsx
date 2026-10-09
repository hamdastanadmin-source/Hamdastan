'use client';

import dynamic from 'next/dynamic';

import type { ResultDimension } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * «DNA اجتماعی تو» — the seven axes as one shape, and under it the
 * exact value of every axis, so nothing the chart shows is only a shape.
 *
 * The shape is Recharts, loaded on demand: still rendered on the server, but
 * kept out of the bundle of every screen that merely *can* reach the result.
 * While it loads, an empty box of the chart's own height holds its place, so
 * nothing below moves.
 */
const SocialDnaRadar = dynamic(() => import('./SocialDnaRadar').then((m) => m.SocialDnaRadar), {
  loading: () => <div className="h-72 w-full" />,
});

/** Fetches the radar ahead of need — the questionnaire calls it while the result is being built. */
export function preloadSocialDnaChart(): void {
  void import('./SocialDnaRadar');
}

export function SocialDnaChart({ dimensions }: { dimensions: ResultDimension[] }) {
  return (
    <div className="flex flex-col gap-5">
      {/* A picture of the list below, which is what assistive technology reads. */}
      <div aria-hidden="true">
        <SocialDnaRadar dimensions={dimensions} />
      </div>

      {/* The chart's data, word for word. */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4">
        {dimensions.map((dimension) => (
          <div key={dimension.key} className="flex items-baseline justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{dimension.label}</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {toPersianDigits(Math.round(dimension.value))}
              <span className="sr-only"> از ۱۰</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
