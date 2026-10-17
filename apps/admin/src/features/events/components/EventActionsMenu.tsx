'use client';

import Link from 'next/link';
import { Copy, MoreHorizontal, Pencil, Ticket } from 'lucide-react';

import type { AdminEventSummary, EventStatusAction } from '@hamdastan/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';

import { ACTION_LABELS, ACTIONS_FOR } from '../utils/labels';

/** A row's actions: edit, bookings, duplicate, and the status moves its status allows. */
export function EventActionsMenu({
  event,
  disabled,
  onStatus,
  onDuplicate,
}: {
  event: AdminEventSummary;
  disabled?: boolean;
  onStatus: (action: EventStatusAction) => void;
  onDuplicate: () => void;
}) {
  const can = useAdminCan();
  const writable = can('events.write');
  const actions = can('events.publish') ? ACTIONS_FOR[event.status] : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`عملیات «${event.title}»`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild>
          <Link href={`/events/${event.id}/edit`}>
            <Pencil aria-hidden="true" />
            {writable && event.status !== 'archived' ? 'ویرایش' : 'مشاهده'}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/events/${event.id}/edit?tab=bookings`}>
            <Ticket aria-hidden="true" />
            رزروها
          </Link>
        </DropdownMenuItem>
        {writable && (
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy aria-hidden="true" />
            تکثیر
          </DropdownMenuItem>
        )}
        {actions.length > 0 && <DropdownMenuSeparator />}
        {actions.map((action) => (
          <DropdownMenuItem key={action} onSelect={() => onStatus(action)} variant={action === 'publish' ? 'default' : 'destructive'}>
            {action === 'publish' && event.status === 'scheduled' ? 'تغییر زمان انتشار' : ACTION_LABELS[action]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
