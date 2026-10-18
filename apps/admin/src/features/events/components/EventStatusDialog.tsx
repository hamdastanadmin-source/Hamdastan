'use client';

import { useState } from 'react';

import type { EventStatusAction, EventStatusInput } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from '@hamdastan/ui';

import { Field } from '@/components';
import { formatDateTime } from '@/lib';

import { ACTION_LABELS, CONFIRM_COPY } from '../utils/labels';

/**
 * Confirms a status change. Publishing asks when — now, or a time ahead,
 * which schedules it; unpublishing, cancelling and archiving say what they
 * take away. The parent remounts it per action (by `key`).
 */
export function EventStatusDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { action: EventStatusAction; title: string } | null;
  onCancel: () => void;
  onConfirm: (input: EventStatusInput) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [at, setAt] = useState('');
  const publishing = pending?.action === 'publish';
  const scheduled = publishing && at !== '' && new Date(at) > new Date();

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await onConfirm({ action: pending.action, publishAt: scheduled ? new Date(at).toISOString() : null });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{pending && `${ACTION_LABELS[pending.action]} «${pending.title}»`}</DialogTitle>
          <DialogDescription>
            {publishing ? 'اگر خالی بماند، همین حالا منتشر می‌شود؛ با انتخاب زمانی در آینده، انتشار زمان‌بندی می‌شود.' : pending && CONFIRM_COPY[pending.action]}
          </DialogDescription>
        </DialogHeader>
        {publishing && (
          <Field label="زمان انتشار" htmlFor="publish-at" hint={at ? formatDateTime(new Date(at).toISOString()) : 'همین حالا'}>
            <Input id="publish-at" type="datetime-local" dir="ltr" value={at} onChange={(event) => setAt(event.target.value)} />
          </Field>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant={publishing ? 'default' : 'destructive'} onClick={confirm} loading={busy}>
            {scheduled ? 'زمان‌بندی انتشار' : pending && ACTION_LABELS[pending.action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
