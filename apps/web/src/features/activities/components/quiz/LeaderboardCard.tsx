import { Trophy } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { formatDurationFa, toPersianDigits } from '@hamdastan/shared/format/persian';
import type { Leaderboard, LeaderboardEntry } from '@hamdastan/types';

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3 text-sm', entry.me && 'bg-accent font-semibold')} aria-current={entry.me ? 'true' : undefined}>
      <span className="w-7 shrink-0 tabular-nums">{toPersianDigits(entry.rank)}</span>
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {entry.name}
        {entry.me && <span className="ms-1.5 text-xs text-muted-foreground">(تو)</span>}
      </span>
      <span className="tabular-nums">{toPersianDigits(entry.score)}٪</span>
      <span className="w-24 shrink-0 text-end text-xs text-muted-foreground">{formatDurationFa(entry.durationMs)}</span>
    </li>
  );
}

/**
 * A competition's leaderboard: rank, handle, score and time, the person's
 * own row marked by weight and «(تو)» — never violet — and added under the
 * list when it is below it. Says when the ranking is final.
 */
export function LeaderboardCard({ board }: { board: Leaderboard }) {
  const outside = board.me && !board.entries.some((entry) => entry.me) ? board.me : null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="leaderboard">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="leaderboard" className="flex items-center gap-2 text-lg font-bold leading-tight">
          <Trophy aria-hidden="true" className="size-5" />
          جدول امتیازات
        </h2>
        <span className="text-xs text-muted-foreground">
          {board.final ? 'نتیجه‌ی نهایی' : 'تا پایان مسابقه تغییر می‌کنه'} — {toPersianDigits(board.total)} نفر
        </span>
      </div>
      {board.entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">هنوز کسی شرکت نکرده؛ اولین نفر باش.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <ol className="divide-y divide-border">
            {board.entries.map((entry) => (
              <Row key={entry.rank} entry={entry} />
            ))}
          </ol>
          {outside && (
            <ol className="border-t-2 border-dashed border-border" aria-label="جایگاه تو">
              <Row entry={outside} />
            </ol>
          )}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">رتبه با نمره و سپس با زمانِ بین «شروع» و ثبت تعیین می‌شه.</p>
    </section>
  );
}
