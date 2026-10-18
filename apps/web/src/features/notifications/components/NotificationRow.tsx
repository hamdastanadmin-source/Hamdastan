'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

import type { NotificationItem } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';
import { cn } from '@hamdastan/shared/cn';

import { notificationsService } from '@/services';

import { stampOf } from '../utils/dates';
import { CATEGORY_ICONS, categoryLabel } from '../utils/labels';

/**
 * One notification, as a card: the category's icon, the title, when, the
 * short line and — when the campaign has one — its image, full width at
 * 16:9 so it can actually be seen. Unread is a tinted card, bold title and a
 * dot (also said in words, for screen readers); read is quiet. The card
 * opens it through `/notifications/:id`, which asks the API where it leads;
 * an expired one, or one that leads nowhere, is not a link. The cross in
 * the corner dismisses it.
 */
export function NotificationRow({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: string) => void }) {
  const Icon = CATEGORY_ICONS[item.category];
  const linked = item.actionable && !item.expired;

  const content = (
    <>
      <span className="flex items-start gap-3 pe-7">
        <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon aria-hidden="true" className="size-5 text-foreground/70" />
          {!item.read && (
            <span aria-hidden="true" className="absolute -top-0.5 end-0 size-3 rounded-full border-2 border-card bg-foreground" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn('text-sm leading-snug', item.read ? 'font-medium' : 'font-bold')}>
            <span className="sr-only">{item.read ? 'خوانده‌شده: ' : 'خوانده‌نشده: '}</span>
            {item.title}
          </span>
          {item.body && <span className="text-sm leading-relaxed text-muted-foreground">{item.body}</span>}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span>{categoryLabel(item.category)}</span>
            <span aria-hidden="true">•</span>
            <span>{stampOf(item.createdAt)}</span>
            {item.expired && <span className="rounded-full bg-secondary px-2 py-0.5">منقضی شده</span>}
          </span>
        </span>
      </span>
      {item.imageId && (
        // eslint-disable-next-line @next/next/no-img-element -- served by our API, at most 250 KB, already sized.
        <img
          src={notificationsService.mediaUrl(item.imageId)}
          alt=""
          loading="lazy"
          className="mt-3 aspect-video w-full rounded-xl border border-border bg-secondary object-cover"
        />
      )}
    </>
  );

  const card = cn(
    'block rounded-2xl border p-4 text-start outline-none transition-colors',
    item.read ? 'border-border bg-card' : 'border-foreground/15 bg-accent/60',
    linked && 'hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
    item.expired && 'opacity-70'
  );

  return (
    <li className="relative">
      {linked ? (
        <Link href={`/notifications/${item.id}`} prefetch={false} className={card}>
          {content}
        </Link>
      ) : (
        <div className={card}>{content}</div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="touch"
        className="absolute end-1 top-1 rounded-full text-muted-foreground hover:text-foreground"
        aria-label={`حذف اعلان «${item.title}»`}
        onClick={() => onDismiss(item.id)}
      >
        <X aria-hidden="true" />
      </Button>
    </li>
  );
}
