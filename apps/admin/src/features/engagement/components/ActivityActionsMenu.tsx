'use client';

import Link from 'next/link';
import { BarChart3, Copy, Eye, MoreHorizontal, Pencil } from 'lucide-react';

import type { ActivityStatusAction, AdminActivitySummary } from '@hamdastan/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hamdastan/ui';

import { ACTION_LABELS, ACTIONS_FOR } from '../utils/labels';

/** A row's actions: open, edit, preview, the status moves its status allows, duplicate. */
export function ActivityActionsMenu({
  activity,
  disabled,
  onStatus,
  onDuplicate,
}: {
  activity: AdminActivitySummary;
  disabled?: boolean;
  onStatus: (action: ActivityStatusAction) => void;
  onDuplicate: () => void;
}) {
  const editable = activity.status !== 'archived';
  const actions = ACTIONS_FOR[activity.status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`عملیات «${activity.title}»`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild>
          <Link href={`/engagement/${activity.id}`}>
            <BarChart3 aria-hidden="true" />
            مشاهده‌ی نتایج
          </Link>
        </DropdownMenuItem>
        {editable && (
          <DropdownMenuItem asChild>
            <Link href={`/engagement/${activity.id}/edit`}>
              <Pencil aria-hidden="true" />
              ویرایش
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/engagement/${activity.id}/edit?step=preview`}>
            <Eye aria-hidden="true" />
            پیش‌نمایش
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy aria-hidden="true" />
          تکثیر
        </DropdownMenuItem>
        {actions.length > 0 && <DropdownMenuSeparator />}
        {actions.map((action) => (
          <DropdownMenuItem
            key={action}
            onSelect={() => onStatus(action)}
            variant={action === 'close' || action === 'archive' ? 'destructive' : 'default'}
          >
            {ACTION_LABELS[action]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
