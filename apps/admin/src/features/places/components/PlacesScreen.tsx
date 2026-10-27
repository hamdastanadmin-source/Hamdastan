'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleAlert, MapPinned, Plus } from 'lucide-react';

import { PLACE_STATUS_LABELS } from '@hamdastan/config';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
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
import { useWorldOptions } from '@/hooks';
import { formatCount } from '@/lib';

import { useMaps } from '../hooks/use-maps';
import { usePlaceActions } from '../hooks/use-place-actions';
import { PLACE_STATUS_BADGE } from '../utils/labels';
import { ConfirmDialog } from './ConfirmDialog';
import { CreatePlaceDialog } from './CreatePlaceDialog';
import { PlaceRowActions } from './PlaceRowActions';

const COLUMNS = 5;

function Thumbnail({ id }: { id: string | null }) {
  const { asset } = useMediaAsset(id);
  return (
    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/50 text-muted-foreground">
      {asset ? <MediaPreview asset={asset} className="size-full" /> : <MapPinned aria-hidden="true" className="size-4" />}
    </div>
  );
}

/**
 * «مکان‌ها»: every world's map — one per world. The places inside a map,
 * and the places inside those, are managed on the map's own page.
 */
export function PlacesScreen() {
  const router = useRouter();
  const can = useAdminCan();
  const writable = can('worlds.manage');
  const worlds = useWorldOptions();
  const { items, error, loading, reload } = useMaps();
  const [creating, setCreating] = useState(false);
  const actions = usePlaceActions({ onChanged: reload, onDeleted: reload });

  const worldName = (id: string) => worlds.find((world) => world.id === id)?.name ?? '—';
  const withoutMap = worlds.filter((world) => world.status !== 'archived' && !items?.some((map) => map.worldId === world.id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">مکان‌ها</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            هر جهان یک نقشه دارد که بالای صفحه‌ی خانه‌اش نمایش داده می‌شود. مکان‌ها روی نقشه پین می‌شوند و هر مکان می‌تواند مکان‌هایی داخل خودش داشته باشد — تا دو لایه.
            مکان‌های داخل هر نقشه در صفحه‌ی همان نقشه مدیریت می‌شوند.
          </p>
        </div>
        {writable && (
          <Button onClick={() => setCreating(true)} disabled={!items || withoutMap.length === 0}>
            <Plus aria-hidden="true" />
            نقشه‌ی جدید
          </Button>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>نقشه‌ها بارگذاری نشدند</AlertTitle>
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
                <TableHead className="ps-4">نقشه</TableHead>
                <TableHead>جهان</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="hidden sm:table-cell">مکان‌های داخل</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 3 }, (_, row) => (
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
                      <MapPinned aria-hidden="true" className="size-8" />
                      هنوز هیچ جهانی نقشه ندارد؛ با «نقشه‌ی جدید» شروع کنید.
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {items?.map((map) => (
                <TableRow key={map.id}>
                  <TableCell className="min-w-48 whitespace-normal ps-4">
                    <div className="flex items-center gap-3">
                      <Thumbnail id={map.imageId} />
                      <Link href={`/places/${map.id}`} className="font-medium hover:underline">
                        {map.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{worldName(map.worldId)}</TableCell>
                  <TableCell>
                    <Badge variant={PLACE_STATUS_BADGE[map.status]}>{PLACE_STATUS_LABELS[map.status]}</Badge>
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">{formatCount(map.childCount)}</TableCell>
                  <TableCell className="pe-4">
                    <PlaceRowActions place={map} actions={actions} writable={writable} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <CreatePlaceDialog
        target={{ worlds: withoutMap }}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(map) => router.push(`/places/${map.id}`)}
      />
      <ConfirmDialog {...actions.dialog} />
    </div>
  );
}
