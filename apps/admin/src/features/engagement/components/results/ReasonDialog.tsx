'use client';

import { useState } from 'react';

import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from '@hamdastan/ui';

/**
 * Asks for a note before a decision that is kept on record — rejecting a
 * submission, revoking XP. `required` refuses an empty note.
 */
export function ReasonDialog({
  open,
  title,
  description,
  label,
  confirmLabel,
  destructive = false,
  required = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  confirmLabel: string;
  destructive?: boolean;
  required?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reason">{label}</Label>
          <Textarea
            id="reason"
            rows={3}
            maxLength={ENGAGEMENT_LIMITS.REASON_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={confirm}
            loading={busy}
            disabled={required && reason.trim().length === 0}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
