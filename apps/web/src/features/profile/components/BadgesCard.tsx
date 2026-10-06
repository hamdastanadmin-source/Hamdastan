import { IdCard, Palette, Sparkles, type LucideIcon } from 'lucide-react';

import type { BadgeIcon } from '@hamdastan/config';
import type { EarnedBadge } from '@hamdastan/types';
import { Badge, Card, CardContent } from '@hamdastan/ui';

/** One drawing per `BADGE_ICONS` key; a new key in the catalog fails to compile until it has one. */
const BADGE_ICON: Record<BadgeIcon, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  'id-card': IdCard,
};

/** «نشان‌های من»: the count, and the badges earned so far in a three-column grid. */
export function BadgesCard({ badges }: { badges: EarnedBadge[] }) {
  return (
    <section aria-labelledby="badges-title">
      <Card className="rounded-2xl shadow-none">
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="badges-title" className="text-base font-semibold">
              نشان‌های من
            </h2>
            <Badge variant="secondary">{badges.length.toLocaleString('fa-IR')}</Badge>
          </div>

          {badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">با انجام ماموریت‌ها، نشان‌هات اینجا جمع می‌شن.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3">
              {badges.map((badge) => {
                const Icon = BADGE_ICON[badge.icon];
                return (
                  <li key={badge.id} title={badge.description} className="flex flex-col items-center gap-2 text-center">
                    <span className="flex size-14 items-center justify-center rounded-full border border-border bg-secondary">
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <span className="text-xs font-medium">{badge.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
