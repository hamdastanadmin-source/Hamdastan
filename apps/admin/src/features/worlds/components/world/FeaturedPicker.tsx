'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

import { WORLD_SECTION_LABELS } from '@hamdastan/config';
import type { WorldHomeCandidate, WorldHomeKind } from '@hamdastan/types';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Skeleton } from '@hamdastan/ui';

import { CONTENT_STATUS_BADGE, CONTENT_STATUS_LABELS } from '@/features/content';
import { errorMessage } from '@/lib';
import { adminWorldsService } from '@/services';

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Chooses an item to feature in a home section: only items of the section's
 * kind already filed under this world are offered — in any status, since a
 * draft can be featured ahead of its publication; it shows once it is live.
 */
export function FeaturedPicker({
  worldId,
  kind,
  chosen,
  onPick,
  onClose,
}: {
  worldId: string;
  kind: WorldHomeKind | null;
  chosen: string[];
  onPick: (item: WorldHomeCandidate) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<WorldHomeCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    let active = true;
    const timer = setTimeout(() => {
      adminWorldsService.candidates(worldId, kind, q).then(
        (list) => {
          if (!active) return;
          setItems(list);
          setError(null);
        },
        (caught) => active && setError(errorMessage(caught))
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [worldId, kind, q]);

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind && `افزودن مورد ویژه به «${WORLD_SECTION_LABELS[kind]}»`}</DialogTitle>
          <DialogDescription>فقط مواردی که به این دنیا متصل‌اند. موردی که هنوز منتشر نشده، پس از انتشار نمایش داده می‌شود.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input type="search" value={q} onChange={(event) => setQ(event.target.value)} placeholder="جست‌وجوی عنوان" aria-label="جست‌وجو" className="ps-9" />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!items && !error && <Skeleton className="h-24 w-full" />}
          {items?.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">موردی پیدا نشد؛ اول محتوا را به این دنیا متصل کنید.</p>}
          <ul className="flex flex-col divide-y">
            {items?.map((item) => {
              const picked = chosen.includes(item.id);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title || 'بدون عنوان'}</p>
                    <Badge variant={CONTENT_STATUS_BADGE[item.status]} className="mt-1">
                      {CONTENT_STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={picked} onClick={() => onPick(item)}>
                    {picked ? 'افزوده شد' : 'افزودن'}
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
