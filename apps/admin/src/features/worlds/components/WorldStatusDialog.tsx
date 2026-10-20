'use client';

import { useState } from 'react';

import type { WorldStatusAction } from '@hamdastan/types';
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@hamdastan/ui';

import { WORLD_ACTION_LABELS, WORLD_CONFIRM_COPY } from '../utils/labels';

/** Asks before a world is taken away from people — unpublished or archived — and says what that does. */
export function WorldStatusDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { action: WorldStatusAction; name: string } | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{pending && `${WORLD_ACTION_LABELS[pending.action]} «${pending.name}»`}</DialogTitle>
          <DialogDescription>{pending && WORLD_CONFIRM_COPY[pending.action]}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirm} loading={busy}>
            {pending && WORLD_ACTION_LABELS[pending.action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
