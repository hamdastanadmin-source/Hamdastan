import Link from 'next/link';
import { ChevronLeft, Clock } from 'lucide-react';

import { ACTIVITY_TYPE_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import type { ActivityCard as ActivityCardData } from '@hamdastan/types';
import { Badge } from '@hamdastan/ui';

import { RewardChip } from '@/features/profile';

import { minutesLabel, STATUS_LABELS, worldLabel } from '../utils/activity';

/**
 * An activity as a row-card: type, the world it belongs to, status, title,
 * short description, time and — when the admin chose to show it — the
 * reward. Inside a world's own pages the world badge is left out
 * (`withWorld={false}`); it would only repeat the screen's title. The whole
 * card is the link; no button inside it, so a screen keeps its one primary
 * action.
 */
export function ActivityCard({
  card,
  withWorld = true,
  className,
}: {
  card: ActivityCardData;
  withWorld?: boolean;
  className?: string;
}) {
  const world = withWorld ? worldLabel(card.worlds) : null;

  return (
    <Link
      href={`/activities/${card.id}`}
      className={cn(
        'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <span className="flex items-center gap-2">
        <Badge variant="outline">{ACTIVITY_TYPE_LABELS[card.type]}</Badge>
        {world && (
          <Badge variant="outline" className="min-w-0 font-medium text-muted-foreground">
            <span className="truncate">{world}</span>
          </Badge>
        )}
        {card.status !== 'not_started' && (
          <Badge variant={card.status === 'completed' ? 'success' : card.status === 'pending_review' ? 'warning' : 'secondary'}>
            {STATUS_LABELS[card.status]}
          </Badge>
        )}
        {/* rtl-ok: "forward" points left in an RTL layout. */}
        <ChevronLeft aria-hidden="true" className="ms-auto size-4 text-muted-foreground" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-bold leading-snug">{card.title}</span>
        {card.summary && <span className="text-sm leading-relaxed text-muted-foreground">{card.summary}</span>}
      </span>
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-3.5" />
          {minutesLabel(card.estimatedMinutes)}
        </span>
        {card.xp !== null && <RewardChip xp={card.xp} muted={!card.canSubmit} />}
      </span>
    </Link>
  );
}
