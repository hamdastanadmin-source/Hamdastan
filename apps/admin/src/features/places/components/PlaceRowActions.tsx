'use client';

import Link from 'next/link';
import { Eye, EyeOff, Pencil, Trash2, type LucideIcon } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { AdminPlaceSummary } from '@hamdastan/types';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@hamdastan/ui';

import type { usePlaceActions } from '../hooks/use-place-actions';
import { PLACE_ACTION_LABELS } from '../utils/labels';

/**
 * One icon action, named by its tooltip (and, for a screen reader, its
 * label). Disabled with the reason in the tooltip instead of hidden, so a
 * row keeps its shape and says why.
 */
function IconAction({
  icon: Icon,
  label,
  onClick,
  href,
  disabled,
  destructive,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      asChild={Boolean(href) && !disabled}
      className={cn(destructive && 'text-muted-foreground hover:text-destructive')}
    >
      {href && !disabled ? (
        <Link href={href}>
          <Icon aria-hidden="true" />
        </Link>
      ) : (
        <Icon aria-hidden="true" />
      )}
    </Button>
  );
  return (
    <Tooltip>
      {/* A disabled button takes no pointer events; the span keeps its tooltip. */}
      <TooltipTrigger asChild>{disabled ? <span tabIndex={0}>{button}</span> : button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * A place's own actions, wherever it is listed — a map in the list of maps,
 * a place inside another on that place's page: edit, publish or unpublish,
 * delete. Without `worlds.manage`, only edit (which opens it to read).
 */
export function PlaceRowActions({
  place,
  actions,
  writable,
}: {
  place: AdminPlaceSummary;
  actions: ReturnType<typeof usePlaceActions>;
  writable: boolean;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1">
      <IconAction icon={Pencil} label={`ویرایش «${place.name}»`} href={`/places/${place.id}`} />
      {writable && (
        <>
          {place.status === 'published' ? (
            <IconAction icon={EyeOff} label={`${PLACE_ACTION_LABELS.unpublish} «${place.name}»`} onClick={() => actions.run(place, 'unpublish')} />
          ) : (
            <IconAction
              icon={Eye}
              label={place.imageId ? `${PLACE_ACTION_LABELS.publish} «${place.name}»` : 'برای انتشار، اول تصویر مکان را انتخاب کنید'}
              disabled={!place.imageId}
              onClick={() => actions.run(place, 'publish')}
            />
          )}
          <IconAction
            icon={Trash2}
            destructive
            label={
              place.status === 'published'
                ? 'مکان منتشرشده حذف نمی‌شود؛ اول انتشارش را لغو کنید'
                : place.childCount > 0
                  ? 'این مکان، مکان‌های داخلی دارد؛ اول آن‌ها را حذف کنید'
                  : `حذف «${place.name}»`
            }
            disabled={place.status === 'published' || place.childCount > 0}
            onClick={() => actions.remove(place)}
          />
        </>
      )}
    </div>
  );
}
