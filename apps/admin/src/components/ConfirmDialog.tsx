'use client';

import { useState } from 'react';

import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@hamdastan/ui';

/**
 * Asks before something is taken away from people — unpublished, archived or
 * deleted — and says what that does. Null `pending` keeps it closed.
 */
export function ConfirmDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { title: string; description: string; confirm: string } | null;
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
          <DialogTitle>{pending?.title}</DialogTitle>
          <DialogDescription>{pending?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirm} loading={busy}>
            {pending?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
