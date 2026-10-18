'use client';

import { useState } from 'react';

import type { AdminUser } from '@hamdastan/types';
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

import { fullName } from '../utils/format';

/** The two actions that take someone's access away, and so ask first. */
export type ConfirmAction = 'deactivate' | 'delete';

const COPY: Record<ConfirmAction, { title: string; confirm: string; body: (name: string) => string }> = {
  deactivate: {
    title: 'غیرفعال کردن کاربر',
    confirm: 'غیرفعال کردن',
    body: (name) =>
      `«${name}» دیگر نمی‌تواند وارد پنل مدیریت شود و همه‌ی نشست‌های باز او فوراً بسته می‌شود. هر زمان بخواهید، می‌توانید دوباره فعالش کنید.`,
  },
  delete: {
    title: 'حذف کاربر',
    confirm: 'حذف کاربر',
    body: (name) =>
      `«${name}» برای همیشه از فهرست حذف می‌شود و همه‌ی نشست‌های باز او بسته می‌شود. این کار برگشت‌پذیر نیست؛ برای دسترسی دوباره باید او را از نو ثبت کنید.`,
  },
};

type ConfirmUserDialogProps = {
  /** What is about to happen, and to whom; the dialog is open while set. */
  pending: { action: ConfirmAction; user: AdminUser } | null;
  onCancel: () => void;
  onConfirm: (action: ConfirmAction, user: AdminUser) => Promise<void>;
};

/** Confirms deactivating or deleting a user. Activating needs no confirmation. */
export function ConfirmUserDialog({ pending, onCancel, onConfirm }: ConfirmUserDialogProps) {
  const [busy, setBusy] = useState(false);
  const copy = pending ? COPY[pending.action] : null;

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await onConfirm(pending.action, pending.user);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && !busy && onCancel()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription>{pending && copy?.body(fullName(pending.user))}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={confirm} loading={busy}>
            {copy?.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
