import type { AccountProgress } from '@hamdastan/types';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { XpAmount } from '@/components';

import { SectionHeading } from './SectionHeading';

/**
 * «پیشرفت من» — the numbers, the recent rewards, and how to earn more. Plain
 * type on the page, no cards: three figures and a short list do not need a
 * frame to be read as a group.
 */
export function ProgressSection({ progress }: { progress: AccountProgress }) {
  const { level, xpTotal, nextLevelXp, recent } = progress;

  const stats = [
    { label: 'سطح', value: toPersianDigits(level) },
    { label: 'مجموع', value: <XpAmount value={xpTotal} /> },
    {
      label: 'تا سطح بعد',
      value: nextLevelXp === null ? '—' : <XpAmount value={nextLevelXp - xpTotal} />,
    },
  ];

  return (
    <section aria-labelledby="progress" className="flex flex-col gap-4">
      <SectionHeading id="progress">پیشرفت من</SectionHeading>

      <dl className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
            <dd className="text-lg font-bold">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1">
        <h3 className="text-xs text-muted-foreground">فعالیت‌های اخیر</h3>
        {recent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">هنوز ماموریتی انجام ندادی.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border/60">
            {recent.map((activity) => (
              <li key={activity.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span>{activity.label}</span>
                <XpAmount value={activity.xp} signed className="text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        با انجام ماموریت‌ها XP می‌گیری و سطحت بالا می‌ره.
      </p>
    </section>
  );
}
