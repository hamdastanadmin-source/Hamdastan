'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { MEDIA_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { MediaAsset } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { errorMessage } from '@/lib';
import { adminMediaService } from '@/services';

import { useMediaLibrary } from '../hooks/use-media-library';
import { formatSize } from '../utils/media';
import { MediaDetailsDialog } from './MediaDetailsDialog';
import { MediaFilters } from './MediaFilters';
import { MediaTile } from './MediaTile';
import { MediaUploadDialog } from './MediaUploadDialog';

/**
 * «کتابخانه‌ی رسانه و موشن» — every image and motion activities are built
 * from: upload, find by shelf, kind or name, rename, replace (everywhere it
 * is used at once) and delete what nothing uses.
 */
export function MediaLibraryScreen() {
  const library = useMediaLibrary();
  const can = useAdminCan();
  const canWrite = can('activities.write');
  const [uploading, setUploading] = useState(false);
  const [replacing, setReplacing] = useState<MediaAsset | null>(null);
  const [editing, setEditing] = useState<MediaAsset | null>(null);
  const [deleting, setDeleting] = useState<MediaAsset | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error } = library;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminMediaService.remove(deleting.id);
      toast.success(`«${deleting.name}» حذف شد`);
      setDeleting(null);
      library.reload();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const menu = (asset: MediaAsset) =>
    canWrite && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon-sm" aria-label={`گزینه‌های ${asset.name}`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem onSelect={() => setEditing(asset)}>
            <Pencil aria-hidden="true" />
            ویرایش نام و دسته
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setReplacing(asset)}>
            <RefreshCw aria-hidden="true" />
            جایگزینی فایل
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={asset.usage > 0} onSelect={() => setDeleting(asset)}>
            <Trash2 aria-hidden="true" />
            {asset.usage > 0 ? 'در حال استفاده — حذف نمی‌شه' : 'حذف'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">کتابخانه‌ی رسانه و موشن</h1>
          <p className="text-sm text-muted-foreground">
            تصویر و موشن‌هایی که فعالیت‌ها ازشون استفاده می‌کنن؛ هر فایل حداکثر {formatSize(MEDIA_LIMITS.MAX_BYTES)}.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setUploading(true)}>
            <Plus aria-hidden="true" />
            بارگذاری فایل
          </Button>
        )}
      </div>

      <MediaFilters filters={library.filters} onChange={library.setFilters} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {error}
            <Button variant="outline" size="sm" onClick={library.reload}>
              تلاش دوباره
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <ImageOff aria-hidden="true" className="size-8" />
          <p className="text-sm">
            {library.filters.search || library.filters.category || library.filters.kind
              ? 'فایلی با این فیلترها پیدا نشد.'
              : 'هنوز فایلی بارگذاری نشده.'}
          </p>
        </div>
      ) : (
        data && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy={loading}>
            {data.items.map((asset) => (
              <MediaTile key={`${asset.id}:${asset.version}`} asset={asset} menu={menu(asset)} />
            ))}
          </div>
        )
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={library.page <= 1} onClick={() => library.setPage(library.page - 1)}>
            {/* RTL: the previous page lies towards the reading start, on the right. */}
            <ChevronRight aria-hidden="true" />
            قبلی
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {toPersianDigits(library.page)} از {toPersianDigits(pages)}
          </span>
          <Button variant="outline" size="sm" disabled={library.page >= pages} onClick={() => library.setPage(library.page + 1)}>
            بعدی
            <ChevronLeft aria-hidden="true" />
          </Button>
        </div>
      )}

      <MediaUploadDialog
        open={uploading || replacing !== null}
        onOpenChange={(open) => {
          if (open) return;
          setUploading(false);
          setReplacing(null);
        }}
        replacing={replacing}
        onDone={(asset) => {
          toast.success(replacing ? `فایل «${asset.name}» جایگزین شد` : `«${asset.name}» بارگذاری شد`);
          library.reload();
        }}
      />
      <MediaDetailsDialog asset={editing} onOpenChange={(open) => !open && setEditing(null)} onDone={library.reload} />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف «{deleting?.name}»؟</DialogTitle>
            <DialogDescription>این فایل در هیچ فعالیتی استفاده نشده. حذفش برگشت‌پذیر نیست.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={busy}>
                انصراف
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={remove} loading={busy}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
