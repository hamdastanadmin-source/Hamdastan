import Link from 'next/link';
import { Bell } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button } from '@hamdastan/ui';

/**
 * The header's way into the Notification Center, with the unread count the
 * API reported for this render. The count is neutral, like every
 * indicator — the brand colour is the screen's one action.
 */
export function NotificationBell({ unread }: { unread: number }) {
  const label = unread > 0 ? `اعلان‌ها، ${toPersianDigits(unread)} خوانده‌نشده` : 'اعلان‌ها';
  return (
    <Button asChild variant="ghost" size="touch" className="relative -me-3 text-muted-foreground hover:text-foreground">
      <Link href="/notifications" aria-label={label}>
        <Bell aria-hidden="true" />
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute end-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-xs font-bold leading-none text-background"
          >
            {unread > 99 ? '۹۹+' : toPersianDigits(unread)}
          </span>
        )}
      </Link>
    </Button>
  );
}
