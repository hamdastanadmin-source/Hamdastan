'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Spinner } from '@hamdastan/ui';

import { notificationsService } from '@/services';

/**
 * `/notifications/:id` — where a row and a tapped push both lead. It asks
 * the API to open the notification (which marks it read) and goes where
 * the API answers. The API re-checks the destination for this person now:
 * an event they can no longer see, or an expired notification, answers no
 * destination, and the person is returned to the Center with a word why.
 *
 * The write happens in an effect, so a prefetch of this page records nothing.
 */
export function NotificationOpener({ id }: { id: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    notificationsService.open(id).then(
      ({ href }) => {
        if (!active) return;
        if (!href) toast.info('صفحه‌ی این اعلان دیگه در دسترس نیست');
        router.replace(href ?? '/notifications');
      },
      () => {
        if (!active) return;
        toast.error('این اعلان باز نشد');
        router.replace('/notifications');
      }
    );
    return () => {
      active = false;
    };
  }, [id, router]);

  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-live="polite">
      <Spinner aria-hidden="true" className="size-6 text-muted-foreground" />
      <span className="sr-only">در حال باز کردن اعلان</span>
    </div>
  );
}
