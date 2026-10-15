'use client';

import { useEffect, useMemo, useState } from 'react';

import { MEDIA_ACCEPT, MEDIA_CATEGORIES, MEDIA_CATEGORY_LABELS, MEDIA_LIMITS } from '@hamdastan/config';
import type { MediaAsset, MediaCategory } from '@hamdastan/types';
import { mediaUploadSchema } from '@hamdastan/validation';
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
import { formatSize, nameFromFile, tooLarge } from '../utils/media';

/**
 * «بارگذاری فایل»: choose a file, name it and shelve it — or, given
 * `replacing`, a new file for an asset already in use, which keeps its id and
 * so changes everywhere it appears. The size is checked here; whether the
 * file is really an image or a motion is the API's call, from its bytes.
 */
export function MediaUploadDialog({
  open,
  onOpenChange,
  defaultCategory = 'other',
  replacing,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: MediaCategory;
  replacing?: MediaAsset | null;
  onDone: (asset: MediaAsset) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<MediaCategory>(defaultCategory);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Each time it opens, it starts empty.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFile(null);
      setName('');
      setCategory(defaultCategory);
      setError(null);
    }
  }

  // A local preview of an image or a video; nothing leaves the browser until «بارگذاری».
  const previewUrl = useMemo(
    () => (file && /^(image|video)\//.test(file.type) ? URL.createObjectURL(file) : null),
    [file]
  );
  useEffect(() => () => void (previewUrl && URL.revokeObjectURL(previewUrl)), [previewUrl]);

  const choose = (chosen: File | undefined) => {
    setError(null);
    if (!chosen) return setFile(null);
    const problem = tooLarge(chosen);
    if (problem) {
      setFile(null);
      return setError(problem);
    }
    setFile(chosen);
    if (!name) setName(nameFromFile(chosen));
  };

  const submit = async () => {
    if (!file) return setError('فایل رو انتخاب کن');
    if (!replacing) {
      const checked = mediaUploadSchema.pick({ name: true, category: true }).safeParse({ name, category });
      if (!checked.success) return setError(checked.error.issues[0].message);
    }
    setBusy(true);
    try {
      const asset = replacing
        ? await adminMediaService.replace(replacing.id, file)
        : await adminMediaService.upload(file, { name, category });
      rememberAsset(asset);
      onDone(asset);
      onOpenChange(false);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{replacing ? `جایگزینی «${replacing.name}»` : 'بارگذاری فایل'}</DialogTitle>
          <DialogDescription>
            تصویر PNG، JPEG یا WebP، یا موشن Lottie (JSON)، WebM یا MP4 — حداکثر {formatSize(MEDIA_LIMITS.MAX_BYTES)}.
            {replacing && ' هر جا این فایل استفاده شده، فایل جدید نشون داده می‌شه.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="media-file">فایل</Label>
            <Input
              id="media-file"
              type="file"
              accept={MEDIA_ACCEPT}
              onChange={(event) => choose(event.target.files?.[0])}
              aria-invalid={error ? true : undefined}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatSize(file.size)}
              </p>
            )}
          </div>

          {previewUrl && file && (
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
              {file.type.startsWith('video/') ? (
                <video src={previewUrl} className="size-full object-contain" muted loop autoPlay playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL, before upload.
                <img src={previewUrl} alt="" className="size-full object-contain" />
              )}
            </div>
          )}

          {!replacing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="media-name">نام</Label>
                <Input id="media-name" value={name} maxLength={MEDIA_LIMITS.NAME_MAX} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="media-category">دسته</Label>
                <Select value={category} onValueChange={(value) => setCategory(value as MediaCategory)}>
                  <SelectTrigger id="media-category" className="w-full">
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
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              انصراف
            </Button>
          </DialogClose>
          <Button onClick={submit} loading={busy} disabled={!file}>
            {replacing ? 'جایگزینی' : 'بارگذاری'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
