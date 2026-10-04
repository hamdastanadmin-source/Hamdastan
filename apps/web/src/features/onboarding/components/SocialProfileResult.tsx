'use client';

import type { ReactNode } from 'react';
import { Compass, Sparkles, Users, Zap, type LucideIcon } from 'lucide-react';

import { APP_NAME } from '@hamdastan/config';
import type { QuestionnaireResult, ResultDimension } from '@hamdastan/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Progress,
} from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

/**
 * The social-profile result — meaning first, numbers last.
 *
 * 1. A card worth a screenshot: whose profile, a short title, at most two
 *    sentences and the three plain-language insights, signed with the
 *    product's name.
 * 2. The five bars, for whoever wants them, behind «جزئیات بیشتر».
 *
 * The content of the questionnaire's last screen and of the profile's
 * «مشاهده نتیجه کامل» alike — one component, so the two cannot disagree.
 * Everything comes from `apps/api`, built from the person's own scores; no
 * internal code ever appears.
 */

/** One icon per insight the API sends (`onboarding.result.ts`). */
const INSIGHT_ICON: Record<string, LucideIcon> = {
  energy: Zap,
  seeking: Compass,
  structure: Users,
};

function DimensionBar({ dimension }: { dimension: ResultDimension }) {
  const valueText = `${toPersianDigits(Math.round(dimension.value))} از ۱۰`;
  const twoEnded = Boolean(dimension.minLabel && dimension.maxLabel);
  // 1 → the reading start, 10 → the far end. `inset-inline-*` keeps it right in RTL.
  const position = ((dimension.value - 1) / 9) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{dimension.label}</p>
        {!twoEnded && (
          <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
            {valueText}
          </span>
        )}
      </div>

      {twoEnded ? (
        <>
          {/* A marker, not a fill: neither end of a two-ended scale is "more". */}
          <div className="relative h-1.5 rounded-full bg-foreground/10" aria-hidden="true">
            <span
              className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full border-2 border-background bg-foreground"
              style={{ insetInlineStart: `calc(${position}% - 0.375rem)` }}
            />
          </div>
          <div aria-hidden="true" className="flex justify-between text-xs text-muted-foreground">
            <span>{dimension.minLabel}</span>
            <span>{dimension.maxLabel}</span>
          </div>
          <p className="sr-only">
            {`${dimension.label}: ${valueText}، از ${dimension.minLabel} تا ${dimension.maxLabel}`}
          </p>
        </>
      ) : (
        <Progress
          value={dimension.value * 10}
          aria-label={dimension.label}
          getValueLabel={() => valueText}
          className="h-1.5 bg-foreground/10 *:data-[slot=progress-indicator]:bg-foreground/70"
        />
      )}
    </div>
  );
}

export function SocialProfileResult({
  result,
  eyebrow,
}: {
  result: QuestionnaireResult;
  /** Above the title — the line that says whose profile this is. */
  eyebrow: ReactNode;
}) {
  return (
    <>
      <Card className="relative overflow-hidden bg-card shadow-sm">
        {/* A neutral light from the top — depth for the screenshot, not the brand. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--gradient-shell-glow)" />

        <CardHeader className="relative gap-3 space-y-0">
          <Badge variant="outline" className="w-fit font-medium text-muted-foreground">
            {eyebrow}
          </Badge>
          <CardTitle role="heading" aria-level={1} className="text-2xl font-bold leading-snug text-balance">
            {result.title}
          </CardTitle>
          <CardDescription className="leading-relaxed">{result.description}</CardDescription>
        </CardHeader>

        {/* Each insight on a row of its own, between hairlines: the label is
            the start of a sentence, the value its ending. */}
        <CardContent className="relative pb-0">
          <dl className="divide-y border-t">
            {result.insights.map((insight, index) => {
              const Icon = INSIGHT_ICON[insight.key] ?? Sparkles;
              return (
                <div
                  key={insight.key}
                  className="flex flex-col gap-1.5 py-4 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards motion-reduce:animate-none"
                  style={{ animationDelay: `${200 + index * 80}ms` }}
                >
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon aria-hidden="true" className="size-3.5" />
                    {insight.label}
                  </dt>
                  <dd className="text-lg font-semibold">{insight.value}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>

        {/* The signature that travels with a screenshot. */}
        <CardFooter className="relative border-t pt-4 text-xs font-semibold text-muted-foreground">
          {APP_NAME}
        </CardFooter>
      </Card>

      <Accordion type="single" collapsible>
        <AccordionItem value="detail" className="border-b-0">
          <AccordionTrigger className="py-3 text-muted-foreground hover:text-foreground hover:no-underline">
            جزئیات بیشتر
          </AccordionTrigger>
          <AccordionContent className="flex flex-col gap-5 pt-2">
            {result.dimensions.map((dimension) => (
              <DimensionBar key={dimension.key} dimension={dimension} />
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}
