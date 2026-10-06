'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, type BaseTickContentProps } from 'recharts';

import type { ResultDimension } from '@hamdastan/types';
import { ChartContainer, type ChartConfig } from '@hamdastan/ui';
import { colors } from '@hamdastan/ui/tokens';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * «DNA اجتماعی تو» — the five dimensions as one shape, and under it the
 * exact value of every axis, so nothing the chart shows is only a shape.
 *
 * Neutral on purpose: the brand colour belongs to the screen's one action.
 */

const CHART_CONFIG = {
  value: { label: 'امتیاز', color: colors.foreground },
} satisfies ChartConfig;

/** A two-ended axis («برنامه‌ریزی ↔ بداهه») on two lines, so it fits beside the shape. */
function AxisTick({ x, y, textAnchor, payload }: BaseTickContentProps) {
  const [first, second] = String(payload.value).split(' ↔ ');
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill={colors.mutedForeground} fontSize={11}>
      <tspan x={x}>{first}</tspan>
      {second && (
        <tspan x={x} dy="1.3em">
          ↔ {second}
        </tspan>
      )}
    </text>
  );
}

export function SocialDnaChart({ dimensions }: { dimensions: ResultDimension[] }) {
  return (
    <div className="flex flex-col gap-5">
      {/* A picture of the list below, which is what assistive technology reads. */}
      <div aria-hidden="true">
        {/* Recharts anchors each axis label at the edge nearest the chart; in an
            RTL svg "start" flips and the labels run into the shape.
            rtl-ok: the label anchors are physical in the chart's own geometry. */}
        <ChartContainer config={CHART_CONFIG} className="aspect-auto h-72 w-full [&_svg]:[direction:ltr]">
          <RadarChart data={dimensions} outerRadius="62%">
            <PolarGrid />
            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
            <PolarAngleAxis dataKey="label" tick={AxisTick} />
            <Radar
              dataKey="value"
              fill="var(--color-value)"
              fillOpacity={0.12}
              stroke="var(--color-value)"
              strokeWidth={1.5}
              dot={{ r: 3, fillOpacity: 1 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ChartContainer>
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
