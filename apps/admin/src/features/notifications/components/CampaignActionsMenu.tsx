'use client';

import Link from 'next/link';
import { Archive, Ban, Copy, Eye, MoreHorizontal, Pencil } from 'lucide-react';

import type { AdminCampaignSummary } from '@hamdastan/types';
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';

export type CampaignRowAction = 'duplicate' | 'cancel' | 'archive';

const ARCHIVABLE = new Set(['draft', 'sent', 'cancelled', 'failed']);

/** A row's actions — only those the admin's role allows and the campaign's status permits. */
export function CampaignActionsMenu({
  campaign,
  disabled,
  onAction,
}: {
  campaign: AdminCampaignSummary;
  disabled?: boolean;
  onAction: (action: CampaignRowAction) => void;
}) {
  const can = useAdminCan();
  const writable = can('notifications.write');
  const editable = writable && campaign.status === 'draft';
  const cancellable = can('notifications.send') && campaign.status === 'scheduled';
  const archivable = writable && ARCHIVABLE.has(campaign.status);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`عملیات «${campaign.title || 'بدون عنوان'}»`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild>
          <Link href={`/notifications/${campaign.id}`}>
            {editable ? <Pencil aria-hidden="true" /> : <Eye aria-hidden="true" />}
            {editable ? 'ویرایش و ارسال' : 'مشاهده و گزارش'}
          </Link>
        </DropdownMenuItem>
        {writable && (
          <DropdownMenuItem onSelect={() => onAction('duplicate')}>
            <Copy aria-hidden="true" />
            تکثیر
          </DropdownMenuItem>
        )}
        {(cancellable || archivable) && <DropdownMenuSeparator />}
        {cancellable && (
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('cancel')}>
            <Ban aria-hidden="true" />
            لغو ارسال زمان‌بندی‌شده
          </DropdownMenuItem>
        )}
        {archivable && (
          <DropdownMenuItem variant="destructive" onSelect={() => onAction('archive')}>
            <Archive aria-hidden="true" />
            بایگانی
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
