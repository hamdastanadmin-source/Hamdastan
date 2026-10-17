'use client';

import { BellRing } from 'lucide-react';

import type { EventDetail } from '@hamdastan/types';
import { Label, Switch } from '@hamdastan/ui';

import { useEventActions } from '../hooks/use-event-actions';

/**
 * Reminders for an event the person is interested in. In-app is the only
 * kind there is: the event shows under «به‌زودی» on home and in «رویدادهای
 * من» the day before. Push and SMS are listed as not yet available — the
 * product has neither, and says so rather than pretend.
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
          <span className="text-xs text-muted-foreground">یک روز قبل، توی خانه و «رویدادهای من»</span>
        </span>
        <Switch checked={interest.remindInApp} disabled={actions.busy} onCheckedChange={actions.setReminder} />
      </Label>
      <Label className="flex items-center justify-between gap-4 py-2 font-normal opacity-60">
        <span className="font-medium">اعلان گوشی</span>
        <span className="text-xs text-muted-foreground">به‌زودی</span>
      </Label>
      <Label className="flex items-center justify-between gap-4 py-2 font-normal opacity-60">
        <span className="font-medium">پیامک</span>
        <span className="text-xs text-muted-foreground">به‌زودی</span>
      </Label>
    </section>
  );
}
