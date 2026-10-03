import Link from 'next/link';
import { Clock } from 'lucide-react';

import { MISSION_BY_ID, QUESTIONNAIRE_DURATION_LABEL } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { Button } from '@hamdastan/ui';

import { RewardChip } from './RewardChip';

/**
 * The questionnaire, offered as a mission: what it is for, what it takes,
 * what it pays, and one action. Shown on home and in the profile until the
 * questionnaire is finished — never an empty social profile in its place.
 *
 * `primary` gives the action the violet fill; a screen has one such action.
 */

const mission = MISSION_BY_ID.get('personality_test')!;

export function PersonalityTestCard({
  title,
  body,
  primary = true,
  headingLevel = 'h2',
  className,
}: {
  title: string;
  body: string;
  primary?: boolean;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading = headingLevel;
  return (
    <article className={cn('flex flex-col gap-4 rounded-2xl border border-border bg-card p-5', className)}>
      <div className="flex flex-col gap-1.5">
        <Heading className="text-base font-bold leading-snug">{title}</Heading>
        <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-3.5" />
          {QUESTIONNAIRE_DURATION_LABEL}
        </span>
        <RewardChip xp={mission.xpReward} />
      </div>

      <Button asChild size="xl" variant={primary ? 'default' : 'outline'} className="w-full">
        <Link href={mission.ctaHref}>{mission.ctaLabel}</Link>
      </Button>
    </article>
  );
}
