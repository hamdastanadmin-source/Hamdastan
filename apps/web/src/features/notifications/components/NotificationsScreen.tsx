'use client';

import { Fragment } from 'react';
import { CircleAlert, Settings2, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { NotificationFilter, NotificationInbox } from '@hamdastan/types';
import { Alert, AlertDescription, AlertTitle, Button, Skeleton, Spinner, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';
import { HttpError } from '@/services';

import { useInbox } from '../hooks/use-inbox';
import { useOnline } from '../hooks/use-online';
import { GROUP_LABELS, groupOf } from '../utils/dates';
import { FILTER_TABS } from '../utils/labels';
import { NotificationRow } from './NotificationRow';
import { NotificationsEmpty } from './NotificationsEmpty';

/** A filter chip. Selected is the foreground filled — never the brand colour, which is the screen's one action. */
const CHIP =
  'h-9 shrink-0 rounded-full border border-border px-4 text-sm data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:font-semibold data-[state=on]:text-background';

const failure = (error: unknown) =>
  error instanceof HttpError ? error.message : 'ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.';

const EMPTY: Partial<Record<NotificationFilter, string>> = {
  all: 'هنوز اعلانی نداری',
  unread: 'همه‌ی اعلان‌ها رو خوندی',
};

/**
 * `/notifications` — the Notification Center. The tabs are every category
 * the product sends; the list is grouped by day, newest first, a page at a
 * time. «خواندن همه» sits across from the unread count, text only — violet
 * while there is something to read (the screen has no other primary
 * action), disabled when there is not — and a row's cross dismisses it. Every state is the API's answer: loading,
 * empty, could-not-load, and offline.
 */
export function NotificationsScreen({ initial }: { initial: NotificationInbox | null }) {
  const online = useOnline();
  const inbox = useInbox(initial);
  const { items, unread, status } = inbox;

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      toast.error(failure(error));
    }
  };

  // A day heading before the first row of each group.
  const rows = items.map((item, index) => {
    const group = groupOf(item.createdAt);
    return { item, heading: index === 0 || groupOf(items[index - 1].createdAt) !== group ? group : null };
  });

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/" label="خانه" iconOnly />
        <Button asChild variant="ghost" size="touch" className="text-muted-foreground hover:text-foreground">
          <Link href="/profile/settings/notifications" aria-label="تنظیمات اعلان‌ها">
            <Settings2 aria-hidden="true" />
          </Link>
        </Button>
      </ScreenHeader>

      <ScreenBody className="gap-4 pt-1">
        <div className="flex flex-col gap-2">
          <ScreenTitle title="اعلان‌ها" />
          {/* The count and, across from it, the way to clear it: violet while there is something to read, disabled when there is not. */}
          <div className="flex min-h-11 items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {unread > 0 ? `${toPersianDigits(unread)} اعلان خوانده‌نشده` : 'همه‌ی اعلان‌ها خوانده شده'}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              className="-me-3 text-primary hover:bg-primary/10 hover:text-primary disabled:text-muted-foreground"
              disabled={unread === 0}
              onClick={() => run(inbox.markAllRead)}
            >
              خواندن همه
            </Button>
          </div>
        </div>

        {!online && (
          <Alert>
            <WifiOff aria-hidden="true" />
            <AlertTitle>اینترنتت قطعه</AlertTitle>
            <AlertDescription>اعلان‌های تازه بعد از وصل شدن نشون داده می‌شن.</AlertDescription>
          </Alert>
        )}

        <ToggleGroup
          type="single"
          value={inbox.filter}
          onValueChange={(value) => value && inbox.setFilter(value as NotificationFilter)}
          spacing={2}
          aria-label="دسته‌ی اعلان‌ها"
          className="-mx-5 w-[calc(100%+2.5rem)] justify-start overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
        >
          {FILTER_TABS.map((tab) => (
            <ToggleGroupItem key={tab.id} value={tab.id} className={CHIP}>
              {tab.label}
              {tab.id === 'unread' && unread > 0 && <span className="tabular-nums">{toPersianDigits(unread)}</span>}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {status === 'loading' && items.length === 0 ? (
          <ul className="flex flex-col gap-2" aria-busy="true" aria-label="در حال بارگذاری">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="flex gap-3 rounded-2xl border border-border p-4">
                <Skeleton className="size-11 rounded-full" />
                <span className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </span>
              </li>
            ))}
          </ul>
        ) : status === 'error' ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>اعلان‌ها باز نشدن</AlertTitle>
            <AlertDescription>
              <Button variant="outline" size="sm" className="mt-2" onClick={inbox.reload}>
                دوباره امتحان کن
              </Button>
            </AlertDescription>
          </Alert>
        ) : items.length === 0 ? (
          <NotificationsEmpty
            title={EMPTY[inbox.filter] ?? 'اعلانی توی این دسته نیست'}
            description="هر وقت XP بگیری، رویدادی که دنبالش می‌کنی تغییر کنه یا خبری برات باشه، اینجا میاد."
          />
        ) : (
          <ul className={status === 'loading' ? 'flex flex-col gap-2 opacity-60 transition-opacity' : 'flex flex-col gap-2'} aria-busy={status === 'loading'}>
            {rows.map(({ item, heading }) => (
              <Fragment key={item.id}>
                {heading && (
                  <li className="px-1 pb-0.5 pt-4 text-xs font-semibold text-muted-foreground first:pt-0" role="presentation">
                    {GROUP_LABELS[heading]}
                  </li>
                )}
                <NotificationRow item={item} onDismiss={(id) => run(() => inbox.dismiss(id))} />
              </Fragment>
            ))}
          </ul>
        )}

        {inbox.nextCursor && status === 'ready' && (
          <Button variant="outline" className="self-center" disabled={inbox.loadingMore} onClick={() => run(inbox.loadMore)}>
            {inbox.loadingMore && <Spinner aria-hidden="true" />}
            اعلان‌های قبلی
          </Button>
        )}
      </ScreenBody>
    </Screen>
  );
}
