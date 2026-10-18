'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { MediaAsset, MediaCategory, MediaKind } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';

import { useMediaLibrary } from '../hooks/use-media-library';
import { MediaFilters } from './MediaFilters';
import { MediaTile } from './MediaTile';
import { MediaUploadDialog } from './MediaUploadDialog';

/**
 * Choose from the library — one file, or several for a random set — or
 * upload a new one, which is chosen as it arrives. `kind` keeps an image's
 * place to images.
 */
export function MediaPicker({
  open,
  onOpenChange,
  title,
  kind,
  category,
  multiple = false,
  selected: initial = [],
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  kind?: MediaKind;
  category?: MediaCategory;
  multiple?: boolean;
  selected?: string[];
  onConfirm: (ids: string[]) => void;
}) {
  const library = useMediaLibrary({ kind, category });
  const can = useAdminCan();
  const [selected, setSelected] = useState<string[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Each time it opens, it starts from what is chosen now.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(initial);
  }

  const toggle = (id: string) =>
    setSelected((current) =>
      multiple ? (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]) : [id]
    );

  const added = (asset: MediaAsset) => {
    library.reload();
    if (!kind || asset.kind === kind) toggle(asset.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {multiple ? 'چند فایل انتخاب کنید؛ هر بار یکی از آن‌ها به‌صورت تصادفی نمایش داده می‌شود.' : 'یک فایل انتخاب کنید یا فایل جدیدی بارگذاری کنید.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <MediaFilters filters={library.filters} onChange={library.setFilters} lockKind={kind} />
              </div>
              {can('activities.write') && (
                <Button variant="outline" onClick={() => setUploading(true)}>
                  <Upload aria-hidden="true" />
                  بارگذاری
                </Button>
              )}
            </div>

            <div className="max-h-[55vh] overflow-y-auto pe-1">
              {library.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {library.error}
                </p>
              ) : !library.data ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
                  ))}
                </div>
              ) : library.data.items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">فایلی یافت نشد؛ یک فایل بارگذاری کنید.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {library.data.items.map((asset) => (
                    <MediaTile
                      key={`${asset.id}:${asset.version}`}
                      asset={asset}
                      selected={selected.includes(asset.id)}
                      onSelect={() => toggle(asset.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="items-center">
            {multiple && (
              <span className="me-auto text-sm text-muted-foreground">{toPersianDigits(selected.length)} فایل انتخاب شده</span>
            )}
            <DialogClose asChild>
              <Button variant="outline">انصراف</Button>
            </DialogClose>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                onConfirm(selected);
                onOpenChange(false);
              }}
            >
              انتخاب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaUploadDialog open={uploading} onOpenChange={setUploading} defaultCategory={category} onDone={added} />
    </>
  );
}
