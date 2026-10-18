'use client';

import Link from 'next/link';
import { BellRing, ChevronLeft } from 'lucide-react';

import type { EventDetail } from '@hamdastan/types';
import { Label, Switch } from '@hamdastan/ui';

import { useEventActions } from '../hooks/use-event-actions';

/**
 * Reminders for an event the person is interested in. The switch is the
 * in-app reminder: the day before, the event shows under «به‌زودی» on home
 * and in «رویدادهای من», and a notification arrives — on the phone too when
 * the person turned on «اعلان گوشی» in the notification settings, which
 * this card links to. SMS is listed as not yet available — the product has
 * no provider for it, and says so rather than pretend.
 */
export function ReminderCard({ event }: { event: EventDetail }) {
  const actions = useEventActions();
  const { interest } = actions;
  if (!interest || event.phase === 'ended' || event.phase === 'cancelled') return null;

  return (
    <section className="flex flex-col gap-1 rounded-2xl border border-border p-4" aria-labelledby="reminder-heading">
      <h2 id="reminder-heading" className="mb-1 flex items-center gap-2 text-sm font-bold">
        <BellRing aria-hidden="true" className="size-4 text-muted-foreground" />
        یادآوری
      </h2>
      <Label className="flex items-center justify-between gap-4 py-2 font-normal">
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">توی اپ</span>
          <span className="text-xs text-muted-foreground">یک روز قبل، با یک اعلان و توی خانه و «رویدادهای من»</span>
        </span>
        <Switch checked={interest.remindInApp} disabled={actions.busy} onCheckedChange={actions.setReminder} />
      </Label>
      <Link
        href="/profile/settings/notifications"
        className="flex min-h-11 items-center justify-between gap-4 rounded-md py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-medium">اعلان گوشی</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          تنظیمات اعلان‌ها
          {/* rtl-ok: "forward" points left in an RTL layout. */}
          <ChevronLeft aria-hidden="true" className="size-4" />
        </span>
      </Link>
      <Label className="flex items-center justify-between gap-4 py-2 font-normal opacity-60">
        <span className="font-medium">پیامک</span>
        <span className="text-xs text-muted-foreground">به‌زودی</span>
      </Label>
    </section>
  );
}
