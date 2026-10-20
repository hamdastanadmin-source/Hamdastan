'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';

import { formatDurationFa, toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminLeaderboardEntry } from '@hamdastan/types';
import { Card, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@hamdastan/ui';

import { errorMessage } from '@/lib';
import { adminEngagementService } from '@/services';

/**
 * A competition's ranking as the API keeps it: score, then time from
 * «شروع» to submitting, then who submitted first. The panel sees full
 * names; the product shows only handles.
 */
export function LeaderboardPanel({ activityId }: { activityId: string }) {
  const [entries, setEntries] = useState<AdminLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminEngagementService.leaderboard(activityId).then(
      (list) => active && setEntries(list),
      (caught) => active && setError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [activityId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <Card className="gap-0 py-0">
      <Table aria-busy={!entries}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 ps-4">رتبه</TableHead>
            <TableHead>شرکت‌کننده</TableHead>
            <TableHead>نمره</TableHead>
            <TableHead className="pe-4">زمان</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!entries &&
            Array.from({ length: 4 }, (_, row) => (
              <TableRow key={row}>
                {Array.from({ length: 4 }, (_, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-5 w-full max-w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {entries?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Trophy aria-hidden="true" className="size-8" />
                  هنوز کسی در این مسابقه شرکت نکرده است
                </div>
              </TableCell>
            </TableRow>
          )}
          {entries?.map((entry) => (
            <TableRow key={entry.userId}>
              <TableCell className="ps-4 font-semibold tabular-nums">{toPersianDigits(entry.rank)}</TableCell>
              <TableCell>
                {entry.fullName || entry.name}
                {entry.fullName && <span className="block text-xs text-muted-foreground" dir="auto">{entry.name}</span>}
              </TableCell>
              <TableCell className="tabular-nums">{toPersianDigits(entry.score)}٪</TableCell>
              <TableCell className="pe-4 text-sm text-muted-foreground">{formatDurationFa(entry.durationMs)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
