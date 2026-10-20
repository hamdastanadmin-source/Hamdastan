'use client';

import { useState } from 'react';

import type { ArticleStatusAction, ArticleStatusInput } from '@hamdastan/types';
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

import { ARTICLE_ACTION_LABELS, ARTICLE_CONFIRM_COPY } from '../utils/labels';

/**
 * Confirms a status change. Publishing asks when — now, or a date ahead,
 * which schedules it; unpublishing and archiving say what they take away.
 * The parent remounts it per action (by `key`).
 */
export function ArticleStatusDialog({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: { action: ArticleStatusAction; title: string } | null;
  onCancel: () => void;
  onConfirm: (input: ArticleStatusInput) => Promise<void>;
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
          <DialogTitle>{pending && `${ARTICLE_ACTION_LABELS[pending.action]} «${pending.title}»`}</DialogTitle>
          <DialogDescription>
            {publishing
              ? 'تغییرات فعلی ذخیره و منتشر می‌شوند. اگر زمان خالی بماند، همین حالا منتشر می‌شود؛ زمانی در آینده، انتشار را زمان‌بندی می‌کند.'
              : pending && ARTICLE_CONFIRM_COPY[pending.action]}
          </DialogDescription>
        </DialogHeader>
        {publishing && (
          <Field label="تاریخ انتشار" htmlFor="article-publish-at" hint={at ? formatDateTime(new Date(at).toISOString()) : 'همین حالا'}>
            <Input id="article-publish-at" type="datetime-local" dir="ltr" value={at} onChange={(event) => setAt(event.target.value)} />
          </Field>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" variant={publishing ? 'default' : 'destructive'} onClick={confirm} loading={busy}>
            {scheduled ? 'زمان‌بندی انتشار' : pending && ARTICLE_ACTION_LABELS[pending.action]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
