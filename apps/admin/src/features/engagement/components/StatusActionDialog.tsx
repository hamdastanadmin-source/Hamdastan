'use client';

import { useState } from 'react';

import type { ActivityStatusAction } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hamdastan/ui';

import { ACTION_LABELS, CONFIRM_COPY } from '../utils/labels';

/**
 * Confirms a status change that takes an activity away from people —
 * pausing, closing, archiving. Publishing and resuming need no confirmation.
 */
export function StatusActionDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { action: ActivityStatusAction; title: string } | null;
  onCancel: () => void;
  onConfirm: (action: ActivityStatusAction) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await onConfirm(pending.action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{pending && `${ACTION_LABELS[pending.action]} «${pending.title}»`}</DialogTitle>
          <DialogDescription>{pending && CONFIRM_COPY[pending.action]}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={pending?.action === 'pause' ? 'default' : 'destructive'}
            onClick={confirm}
            loading={busy}
          >
            {pending && ACTION_LABELS[pending.action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
