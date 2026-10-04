import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';

import type { MissionId } from '@hamdastan/config';
import type { Mission } from '@hamdastan/types';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Badge, Button } from '@hamdastan/ui';

import { RewardChip } from './RewardChip';
import { SectionCard } from './SectionCard';

/**
 * «ماموریت‌های من» — one card: how many are done («۲ از ۳») beside the
 * title, then open missions with their action, then finished ones as quiet
 * rows with a green check. Colour is never the only signal: every status is
 * also written out.
 *
 * The questionnaire is left out while it is open, because the social-profile
 * section right above is already offering it — but it still counts.
 */

function OpenMission({ mission, primary }: { mission: Mission; primary: boolean }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-bold">{mission.title}</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">{mission.description}</p>
        </div>
        <RewardChip xp={mission.xpReward} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Circle aria-hidden="true" className="size-3.5" />
          انجام نشده
        </span>
        <Button asChild size="touch" variant={primary ? 'default' : 'outline'} className="min-w-28">
          <Link href={mission.ctaHref}>{mission.ctaLabel}</Link>
        </Button>
      </div>
    </li>
  );
}

function DoneMission({ mission, fresh }: { mission: Mission; fresh: boolean }) {
  return (
    <li className="flex min-h-12 items-center gap-3 py-2 first:pt-0 last:pb-0">
      <CheckCircle2
        aria-hidden="true"
        className={cn(
          'size-5 shrink-0 text-success',
          fresh && 'animate-in zoom-in-50 fade-in duration-500 motion-reduce:animate-none'
        )}
      />
      <span className="flex-1 text-sm">{mission.title}</span>
      <span className="text-xs text-success">انجام شد</span>
      <RewardChip xp={mission.xpReward} muted />
    </li>
  );
}

export function MissionsSection({
  missions,
  primaryId,
  freshId,
}: {
  missions: Mission[];
  /** The mission whose action is the screen's primary one, if any. */
  primaryId: MissionId | null;
  /** A mission completed just before arriving here — its check animates in. */
  freshId: MissionId | null;
}) {
  const open = missions.filter((m) => m.status !== 'completed' && m.id !== 'personality_test');
  const done = missions.filter((m) => m.status === 'completed');

  if (open.length === 0 && done.length === 0) return null;

  return (
    <SectionCard
      id="missions"
      title="ماموریت‌های من"
      aside={
        <Badge variant="secondary" className="shrink-0 font-medium">
          {toPersianDigits(done.length)} از {toPersianDigits(missions.length)} انجام شد
        </Badge>
      }
    >
      <ul className="flex flex-col divide-y divide-border">
        {open.map((mission) => (
          <OpenMission key={mission.id} mission={mission} primary={mission.id === primaryId} />
        ))}
        {done.map((mission) => (
          <DoneMission key={mission.id} mission={mission} fresh={mission.id === freshId} />
        ))}
      </ul>
    </SectionCard>
  );
}
