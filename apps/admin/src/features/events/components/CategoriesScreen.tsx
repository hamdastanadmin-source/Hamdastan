'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, CircleAlert, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminEventCategory, EventCategoryInput } from '@hamdastan/types';
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
import { Icon } from '@hamdastan/ui/icons';

import { useAdminCan } from '@/features/auth';
import { MediaPreview, useMediaAsset } from '@/features/media';
import { useOrderedList } from '@/hooks';
import { errorMessage, formatCount } from '@/lib';
import { adminEventsService } from '@/services';

import { CategoryFormDialog } from './CategoryFormDialog';

const COLUMNS = 6;
const load = () => adminEventsService.categories();
const reorder = (ids: string[]) => adminEventsService.reorderCategories(ids);

/** The category's image when it has one, its icon otherwise — as the product shows it. */
function Visual({ category }: { category: AdminEventCategory }) {
  const { asset } = useMediaAsset(category.imageId);
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50">
      {asset ? <MediaPreview asset={asset} className="size-full" /> : <Icon name={category.icon} aria-hidden="true" className="size-5" />}
    </div>
  );
}

/**
 * Event categories: add, edit, order, switch off, and delete one no event
 * uses. Renaming is safe — events are filed under the category, not its name.
 */
export function CategoriesScreen() {
  const can = useAdminCan();
  const writable = can('events.write');
  const { items, error, loading, reload, move } = useOrderedList(load, reorder);
  const [editing, setEditing] = useState<AdminEventCategory | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminEventCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (input: EventCategoryInput) => {
    if (editing === 'new') await adminEventsService.createCategory(input);
    else if (editing) await adminEventsService.updateCategory(editing.id, input);
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
      await adminEventsService.removeCategory(deleting.id);
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
        <div className="flex flex-col gap-1">
          <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
            <Link href="/events">
              {/* rtl-ok: "back" is rightwards in an RTL layout. */}
              <ArrowRight aria-hidden="true" />
              رویدادها
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">دسته‌بندی رویدادها</h1>
          <p className="text-sm text-muted-foreground">ترتیب این فهرست، ترتیب نمایش دسته‌ها در صفحه‌ی رویدادهای اپلیکیشن است.</p>
        </div>
        {writable && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            دسته‌ی جدید
          </Button>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>دسته‌ها بارگذاری نشد</AlertTitle>
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
                <TableHead className="ps-4">دسته</TableHead>
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
                Array.from({ length: 6 }, (_, row) => (
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
                      <Tags aria-hidden="true" className="size-8" />
                      هنوز دسته‌ای تعریف نشده
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items?.map((category, index) => (
                <TableRow key={category.id}>
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <Visual category={category} />
                      <div>
                        <span className="font-medium">{category.name}</span>
                        {category.description && <span className="block text-xs text-muted-foreground">{category.description}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell" dir="ltr">
                    {category.slug}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatCount(category.eventCount)}</TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? 'secondary' : 'outline'}>{category.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {writable && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onMove(category.id, -1)} aria-label={`بالا بردن «${category.name}»`}>
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === items.length - 1}
                          onClick={() => onMove(category.id, 1)}
                          aria-label={`پایین بردن «${category.name}»`}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    {writable && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(category)} aria-label={`ویرایش «${category.name}»`}>
                          <Pencil aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          disabled={category.eventCount > 0}
                          title={category.eventCount > 0 ? 'این دسته رویداد دارد؛ به‌جای حذف، آن را غیرفعال کنید' : undefined}
                          onClick={() => setDeleting(category)}
                          aria-label={`حذف «${category.name}»`}
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
        <CategoryFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          category={editing === 'new' ? undefined : editing}
          onSubmit={save}
        />
      )}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{deleting && `حذف «${deleting.name}»`}</DialogTitle>
            <DialogDescription>این دسته برای همیشه حذف می‌شود. اگر فقط می‌خواهید نمایش داده نشود، آن را غیرفعال کنید.</DialogDescription>
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
