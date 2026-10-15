'use client';

import { useState } from 'react';

import { MEDIA_CATEGORIES, MEDIA_CATEGORY_LABELS, MEDIA_LIMITS } from '@hamdastan/config';
import type { MediaAsset, MediaCategory } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hamdastan/ui';

import { errorMessage } from '@/lib';
import { adminMediaService } from '@/services';

import { rememberAsset } from '../hooks/use-media-asset';

/** A file's name and shelf — the file itself is changed with «جایگزینی». */
export function MediaDetailsDialog({
  asset,
  onOpenChange,
  onDone,
}: {
  asset: MediaAsset | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MediaCategory>('other');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<MediaAsset | null>(null);

  // A newly opened file starts from its own name and shelf.
  if (asset !== shown) {
    setShown(asset);
    if (asset) {
      setName(asset.name);
      setCategory(asset.category);
      setError(null);
    }
  }

  const save = async () => {
    if (!asset) return;
    setBusy(true);
    try {
      rememberAsset(await adminMediaService.update(asset.id, { name, category }));
      onDone();
      onOpenChange(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={asset !== null} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش فایل</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-edit-name">نام</Label>
            <Input id="media-edit-name" value={name} maxLength={MEDIA_LIMITS.NAME_MAX} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-edit-category">دسته</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as MediaCategory)}>
              <SelectTrigger id="media-edit-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_CATEGORIES.map((id) => (
                  <SelectItem key={id} value={id}>
                    {MEDIA_CATEGORY_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button onClick={save} loading={busy}>
            ذخیره
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
