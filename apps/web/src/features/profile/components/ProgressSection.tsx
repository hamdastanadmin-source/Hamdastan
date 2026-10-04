import type { AccountProgress } from '@hamdastan/types';

import { XpAmount } from '@/components';

import { SectionCard } from './SectionCard';

/**
 * «پیشرفت من» — total XP beside the title and the newest rewards. The level
 * and the XP still needed live on the identity card's bar and are not
 * repeated here.
 */
export function ProgressSection({ progress }: { progress: AccountProgress }) {
  const { xpTotal, recent } = progress;

  return (
    <SectionCard
      id="progress"
      title="پیشرفت من"
      description="با انجام ماموریت‌ها XP می‌گیری و سطحت بالا می‌ره."
      aside={
        <span className="shrink-0 text-sm font-bold">
          <XpAmount value={xpTotal} />
        </span>
      }
    >
      <div className="flex flex-col gap-1">
        <h3 className="text-xs text-muted-foreground">فعالیت‌های اخیر</h3>
        {recent.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">هنوز ماموریتی انجام ندادی.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recent.map((activity) => (
              <li key={activity.id} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span>{activity.label}</span>
                <XpAmount value={activity.xp} signed className="text-muted-foreground" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}
