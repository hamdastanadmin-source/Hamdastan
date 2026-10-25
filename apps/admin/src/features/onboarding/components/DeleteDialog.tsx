'use client';

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

/** «حذف …؟» — the confirmation both catalogs ask before deleting. */
export function DeleteDialog({
  title,
  description,
  busy,
  onConfirm,
  onClose,
}: {
  /** Null keeps the dialog closed. */
  title: string | null;
  description: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={title !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={onConfirm} loading={busy}>
            حذف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
