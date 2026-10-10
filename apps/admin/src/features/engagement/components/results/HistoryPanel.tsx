import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminActivityEvent } from '@hamdastan/types';
import { Skeleton } from '@hamdastan/ui';

import { formatDateTime } from '@/lib';

import { AUDIT_LABELS } from '../../utils/labels';

/** The parts of an event's details worth a line. */
function detailLine(event: AdminActivityEvent): string | null {
  const { version, xp, reason, xpAwarded, note } = event.details as Record<string, unknown>;
  const parts = [
    typeof version === 'number' && `نسخه‌ی ${toPersianDigits(version)}`,
    typeof xp === 'number' && `XP: ${toPersianDigits(xp)}`,
    typeof xpAwarded === 'number' && xpAwarded > 0 && `${toPersianDigits(xpAwarded)} XP داده شد`,
    typeof reason === 'string' && `دلیل: ${reason}`,
    typeof note === 'string' && `یادداشت: ${note}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** What admins did to this activity, newest first. */
export function HistoryPanel({ events, loading }: { events: AdminActivityEvent[] | null; loading: boolean }) {
  if (loading && !events) return <Skeleton className="h-40 w-full" />;
  if (!events?.length) return <p className="py-10 text-center text-sm text-muted-foreground">سابقه‌ای نیست.</p>;

  return (
    <ol className="flex flex-col divide-y">
      {events.map((event) => {
        const line = detailLine(event);
        return (
          <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 text-sm">
            <span>
              <strong className="font-semibold">{AUDIT_LABELS[event.action] ?? event.action}</strong>
              {event.adminName && <span className="text-muted-foreground"> — {event.adminName}</span>}
              {line && <span className="block text-xs text-muted-foreground">{line}</span>}
            </span>
            <time className="text-xs text-muted-foreground" dateTime={event.createdAt}>
              {formatDateTime(event.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
