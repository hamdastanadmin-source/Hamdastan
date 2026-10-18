import type { ReactNode } from 'react';
import { BellOff } from 'lucide-react';

import { IconBadge } from '@hamdastan/ui';

/** The Center's empty and error states: the app's own pattern, an icon, a line and an action. */
export function NotificationsEmpty({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <IconBadge tone="muted">
        <BellOff aria-hidden="true" />
      </IconBadge>
      <p className="text-base font-bold">{title}</p>
      {description && <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
