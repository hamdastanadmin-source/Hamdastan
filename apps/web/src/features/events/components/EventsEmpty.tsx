import type { ReactNode } from 'react';
import { CalendarX } from 'lucide-react';

import { IconBadge } from '@hamdastan/ui';

/** The empty and error states of the events screens: the app's own pattern, an icon, a line and an action. */
export function EventsEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <IconBadge tone="muted">
        <CalendarX aria-hidden="true" />
      </IconBadge>
      <p className="text-base font-bold">{title}</p>
      {description && <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
