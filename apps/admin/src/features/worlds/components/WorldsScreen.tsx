'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, Globe, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminWorld, WorldInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { MediaPreview, useMediaAsset } from '@/features/media';
import { useOrderedList } from '@/hooks';
import { errorMessage, formatCount } from '@/lib';
import { adminWorldsService } from '@/services';

import { WorldFormDialog } from './WorldFormDialog';

const COLUMNS = 6;
const load = () => adminWorldsService.list();
const reorder = (ids: string[]) => adminWorldsService.reorder(ids);

function Cover({ id }: { id: string | null }) {
  const { asset } = useMediaAsset(id);
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted/50">
      {asset && <MediaPreview asset={asset} className="size-full" />}
    </div>
  );
}

/**
 * The world list events are filed under: add, edit, order, switch off, and
 * delete one no event uses. Only names and covers for now — membership comes
 * with its own migration.
 */
export function WorldsScreen() {
  const can = useAdminCan();
  const writable = can('worlds.manage');
  const { items, error, loading, reload, move } = useOrderedList(load, reorder);
  const [editing, setEditing] = useState<AdminWorld | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminWorld | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (input: WorldInput) => {
    if (editing === 'new') await adminWorldsService.create(input);
    else if (editing) await adminWorldsService.update(editing.id, input);
    reload();
  };

  const onMove = async (id: string, by: -1 | 1) => {
    try {
      await move(id, by);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminWorldsService.remove(deleting.id);
      toast.success(`«${deleting.name}» حذف شد`);
      setDeleting(null);
      reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">دنیاها</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            دنیاهای داستانی که رویدادها به آن‌ها متصل می‌شوند. ترتیب این فهرست، ترتیب نمایش در اپلیکیشن است.
          </p>
        </div>
        {writable && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            دنیای جدید
          </Button>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>فهرست دنیاها بارگذاری نشد</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
              تلاش دوباره
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="gap-0 py-0">
          <Table aria-busy={loading}>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">دنیا</TableHead>
                <TableHead className="hidden sm:table-cell">نامک</TableHead>
                <TableHead>رویدادها</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="hidden sm:table-cell">ترتیب</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 4 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: COLUMNS }, (_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-5 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {items?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Globe aria-hidden="true" className="size-8" />
                      هنوز دنیایی اضافه نشده
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items?.map((world, index) => (
                <TableRow key={world.id}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <Cover id={world.coverId} />
                      <span className="font-medium">{world.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell" dir="ltr">
                    {world.slug}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCount(world.eventCount)}</TableCell>
                  <TableCell>
                    <Badge variant={world.isActive ? 'secondary' : 'outline'}>{world.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {writable && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(world.id, -1)} aria-label={`بالا بردن «${world.name}»`}>
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === items.length - 1}
                          onClick={() => onMove(world.id, 1)}
                          aria-label={`پایین بردن «${world.name}»`}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    {writable && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(world)} aria-label={`ویرایش «${world.name}»`}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={world.eventCount > 0}
                          title={world.eventCount > 0 ? 'این دنیا به رویدادهایی متصل است؛ به‌جای حذف، آن را غیرفعال کنید' : undefined}
                          onClick={() => setDeleting(world)}
                          aria-label={`حذف «${world.name}»`}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {editing && (
        <WorldFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          world={editing === 'new' ? undefined : editing}
          onSubmit={save}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{deleting && `حذف «${deleting.name}»`}</DialogTitle>
            <DialogDescription>این دنیا برای همیشه حذف می‌شود. اگر فقط می‌خواهید نمایش داده نشود، آن را غیرفعال کنید.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                انصراف
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={remove} loading={busy}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
