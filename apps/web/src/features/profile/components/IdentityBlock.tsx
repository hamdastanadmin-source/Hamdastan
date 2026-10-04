import Link from 'next/link';
import { IdCard, Palette, Sparkles, type LucideIcon } from 'lucide-react';

import { DEFAULT_AVATAR, type BadgeIcon } from '@hamdastan/config';
import type { AccountProfile, EarnedBadge } from '@hamdastan/types';
import { Badge, Card, CardContent } from '@hamdastan/ui';

import { AvatarFigure } from './AvatarFigure';

/** One drawing per `BADGE_ICONS` key; a new key in the catalog fails to compile until it has one. */
const BADGE_ICON: Record<BadgeIcon, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  'id-card': IdCard,
};

/**
 * The top of the hub, as one card: the whole avatar, large, as a link to
 * the avatar studio, and under it the badges earned so far. The name is the
 * screen's `h1` for assistive technology only; the screen shows the avatar.
 */
export function IdentityBlock({ profile, badges }: { profile: AccountProfile; badges: EarnedBadge[] }) {
  return (
    <section aria-label="هویت من">
      <h1 className="sr-only">{profile.displayName ?? 'دوست من'}</h1>

      <Card className="overflow-hidden rounded-2xl shadow-none">
        <Link
          href="/profile/avatar"
          aria-label="ویرایش آواتار"
          className="relative flex justify-center overflow-hidden bg-surface-stage pt-8 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {/* A soft disc behind the head, and a small spark beside it. */}
          <span aria-hidden="true" className="absolute top-6 size-56 rounded-full bg-secondary" />
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="absolute end-10 top-6 size-8 text-warning"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 3v5M4 9l4 3M20 9l-4 3" />
          </svg>

          <AvatarFigure
            avatar={profile.avatar ?? DEFAULT_AVATAR}
            frame="bust"
            label=""
            className="relative size-64 animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
          />
        </Link>

        <CardContent className="flex flex-col gap-4 border-t border-border p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">نشان‌های من</h2>
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
