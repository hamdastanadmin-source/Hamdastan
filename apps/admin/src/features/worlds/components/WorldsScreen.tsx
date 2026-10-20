'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CircleAlert, Globe, MoreHorizontal, Plus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { WORLD_STATUS_LABELS } from '@hamdastan/config';
import type { AdminWorld, WorldStatusAction } from '@hamdastan/types';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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

import { WORLD_ACTION_DONE, WORLD_ACTION_LABELS, WORLD_ACTIONS_FOR, WORLD_STATUS_BADGE } from '../utils/labels';
import { CreateWorldDialog } from './CreateWorldDialog';
import { WorldStatusDialog } from './WorldStatusDialog';

const COLUMNS = 5;
const load = () => adminWorldsService.list();
const reorder = (ids: string[]) => adminWorldsService.reorder(ids);

const inUse = (world: AdminWorld) => world.eventCount + world.articleCount + world.activityCount > 0;

function Cover({ id }: { id: string | null }) {
  const { asset } = useMediaAsset(id);
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted/50">
      {asset && <MediaPreview asset={asset} className="size-full" />}
    </div>
  );
}

/**
 * Every world: where it stands, what is filed under it, its place in the
 * list, and the way into its own page — identity, menu, home and content.
 * A world with content is archived, never deleted.
 */
export function WorldsScreen() {
  const router = useRouter();
  const can = useAdminCan();
  const writable = can('worlds.manage');
  const { items, error, loading, reload, move } = useOrderedList(load, reorder);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<{ world: AdminWorld; action: WorldStatusAction } | null>(null);
  const [deleting, setDeleting] = useState<AdminWorld | null>(null);
  const [busy, setBusy] = useState(false);

  const onMove = async (id: string, by: -1 | 1) => {
    try {
      await move(id, by);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const runStatus = async (world: AdminWorld, action: WorldStatusAction) => {
    try {
      await adminWorldsService.changeStatus(world.id, action);
      toast.success(`«${world.name}» ${WORLD_ACTION_DONE[action]}`);
      reload();
    } catch (caught) {
      // Publishing an incomplete world: its page says what is missing.
      toast.error(errorMessage(caught), { action: { label: 'باز کردن', onClick: () => router.push(`/worlds/${world.id}`) } });
    }
  };

  const onStatus = (world: AdminWorld, action: WorldStatusAction) =>
    action === 'unpublish' || action === 'archive' ? setConfirming({ world, action }) : runStatus(world, action);

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
            هر دنیا هویت، منو و صفحه‌ی خانه‌ی خودش را دارد و اخبار، دانستنی‌ها، رویدادها و فعالیت‌ها به آن متصل می‌شوند. ترتیب این فهرست، ترتیب نمایش در اپلیکیشن است.
          </p>
        </div>
        {writable && (
          <Button onClick={() => setCreating(true)}>
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
                <TableHead>وضعیت</TableHead>
                <TableHead className="hidden md:table-cell">رویداد / محتوا / فعالیت</TableHead>
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
                  <TableCell className="min-w-48 whitespace-normal ps-4">
                    <div className="flex items-center gap-3">
                      <Cover id={world.coverId} />
                      <div className="min-w-0">
                        <Link href={`/worlds/${world.id}`} className="font-medium hover:underline">
                          {world.name}
                        </Link>
                        <span className="block font-mono text-xs text-muted-foreground" dir="ltr">
                          {world.slug}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={WORLD_STATUS_BADGE[world.status]}>{WORLD_STATUS_LABELS[world.status]}</Badge>
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {formatCount(world.eventCount)} / {formatCount(world.articleCount)} / {formatCount(world.activityCount)}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`عملیات «${world.name}»`}>
                          <MoreHorizontal aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem asChild>
                          <Link href={`/worlds/${world.id}`}>
                            <Settings2 aria-hidden="true" />
                            مدیریت دنیا
                          </Link>
                        </DropdownMenuItem>
                        {writable && (
                          <>
                            <DropdownMenuSeparator />
                            {WORLD_ACTIONS_FOR[world.status].map((action) => (
                              <DropdownMenuItem
                                key={action}
                                onSelect={() => onStatus(world, action)}
                                variant={action === 'publish' || action === 'restore' ? 'default' : 'destructive'}
                              >
                                {WORLD_ACTION_LABELS[action]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuItem variant="destructive" disabled={inUse(world)} onSelect={() => setDeleting(world)}>
                              <Trash2 aria-hidden="true" />
                              {inUse(world) ? 'حذف (محتوا دارد؛ بایگانی کنید)' : 'حذف'}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreateWorldDialog open={creating} onOpenChange={setCreating} />

      <WorldStatusDialog
        key={confirming ? `${confirming.world.id}-${confirming.action}` : 'none'}
        pending={confirming && { action: confirming.action, name: confirming.world.name }}
        onCancel={() => setConfirming(null)}
        onConfirm={async () => {
          if (confirming) await runStatus(confirming.world, confirming.action);
          setConfirming(null);
        }}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !busy && setDeleting(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{deleting && `حذف «${deleting.name}»`}</DialogTitle>
            <DialogDescription>این دنیا برای همیشه حذف می‌شود. اگر فقط می‌خواهید نمایش داده نشود، انتشار آن را لغو کنید.</DialogDescription>
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
