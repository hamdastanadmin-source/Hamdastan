'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUp, X } from 'lucide-react';

import { PLACE_LIMITS } from '@hamdastan/config';
import type { WorldHomeCandidate } from '@hamdastan/types';
import { Badge, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hamdastan/ui';

const statusBadge = (item: WorldHomeCandidate | undefined) =>
  !item ? <Badge variant="destructive">پیدا نشد</Badge> : item.live ? <Badge variant="success">باز</Badge> : <Badge variant="outline">بسته</Badge>;

/**
 * The tasks done at this place, in order: activities of the same world,
 * made in the studio. What each pays, and that it pays once, is the
 * activity's own.
 */
export function TasksSection({
  ids,
  worldId,
  activities,
  writable,
  onChange,
}: {
  ids: string[];
  worldId: string;
  /** The world's activities, in any status. */
  activities: WorldHomeCandidate[];
  writable: boolean;
  onChange: (ids: string[]) => void;
}) {
  const byId = new Map(activities.map((item) => [item.id, item]));
  const addable = activities.filter((item) => !ids.includes(item.id));
  const move = (index: number, by: -1 | 1) => {
    const next = [...ids];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      {ids.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">هنوز تسکی به این مکان وصل نیست.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ids.map((id, index) => (
            <li key={id} className="flex items-center gap-2 rounded-lg border p-2 ps-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{byId.get(id)?.title ?? 'فعالیت'}</span>
              {statusBadge(byId.get(id))}
              {writable && (
                <>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, -1)} aria-label="بالا بردن">
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={index === ids.length - 1} onClick={() => move(index, 1)} aria-label="پایین بردن">
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange(ids.filter((item) => item !== id))} aria-label="برداشتن">
                    <X aria-hidden="true" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {writable && (
        <Select value="" onValueChange={(id) => onChange([...ids, id])} disabled={addable.length === 0 || ids.length >= PLACE_LIMITS.ACTIVITIES_MAX}>
          <SelectTrigger className="w-full" aria-label="افزودن تسک">
            <SelectValue placeholder={addable.length === 0 ? 'فعالیت دیگری در این دنیا نیست' : 'افزودن تسک…'} />
          </SelectTrigger>
          <SelectContent>
            {addable.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        تسک‌ها فعالیت‌های همین دنیا هستند و در استودیو ساخته می‌شوند.{' '}
        <Link href={`/engagement/new?world=${worldId}`} className="underline underline-offset-4">
          فعالیت تازه
        </Link>
      </p>
    </div>
  );
}
