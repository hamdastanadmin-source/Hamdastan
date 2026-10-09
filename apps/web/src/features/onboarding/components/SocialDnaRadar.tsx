'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, type BaseTickContentProps } from 'recharts';

import type { ResultDimension } from '@hamdastan/types';
import { ChartContainer, type ChartConfig } from '@hamdastan/ui/chart';
import { colors } from '@hamdastan/ui/tokens';

/**
 * The radar half of «DNA اجتماعی تو». A file of its own so `SocialDnaChart`
 * can load it lazily: it is the only thing in the app that needs Recharts,
 * and it should not ship with every screen that can reach the result.
 *
 * Neutral on purpose: the brand colour belongs to the screen's one action.
 */

const CHART_CONFIG = {
  value: { label: 'امتیاز', color: colors.foreground },
} satisfies ChartConfig;

/** An axis label in the muted text colour. */
function AxisTick({ x, y, textAnchor, payload }: BaseTickContentProps) {
  return (
    <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fill={colors.mutedForeground} fontSize={11}>
      {payload.value}
    </text>
  );
}

export function SocialDnaRadar({ dimensions }: { dimensions: ResultDimension[] }) {
  return (
    // Recharts anchors each axis label at the edge nearest the chart; in an
    // RTL svg "start" flips and the labels run into the shape.
    // rtl-ok: the label anchors are physical in the chart's own geometry.
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
  );
}
