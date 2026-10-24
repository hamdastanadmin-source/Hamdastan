'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { World } from '@hamdastan/types';
import {
  Button,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@hamdastan/ui';

import { MediaImage } from '@/components';

import { BUILT_IN_ARTWORK } from '../utils/artwork';
import { worldHref } from '../utils/pages';

function Banner({ world }: { world: World }) {
  if (world.coverId) return <MediaImage id={world.coverId} alt={world.name} fallback={null} className="aspect-[3/1] w-full" />;
  const builtIn = BUILT_IN_ARTWORK[world.slug];
  if (builtIn) {
    return <Image src={builtIn.src} alt={builtIn.alt} width={1290} height={344} sizes="(max-width: 430px) 100vw, 430px" className="h-auto w-full" />;
  }
  return <span className="flex aspect-[3/1] w-full items-center justify-center bg-muted text-lg font-bold">{world.name}</span>;
}

/**
 * Home's world picker: one row, «جهان‌های هم‌داستان», that opens a bottom
 * sheet of every published world, in the admin's order — each its cover,
 * or the artwork it shipped with, linking to its page. Absent when there is
 * none to show; home never fails because of it.
 */
export function WorldsPicker({ worlds }: { worlds: World[] }) {
  if (worlds.length === 0) return null;
  return (
    <Sheet>
      {/* shadcn's `Item` as the trigger: a neutral row, not the screen's primary action. */}
      <Item variant="outline" asChild className="min-h-14 rounded-2xl px-4 py-3 text-start hover:bg-accent/60">
        <SheetTrigger>
          <ItemContent className="gap-0.5">
            <ItemTitle className="font-semibold">جهان‌های هم‌داستان</ItemTitle>
            <ItemDescription className="text-xs">دنیای داستانی‌ات رو انتخاب کن</ItemDescription>
          </ItemContent>
          <ItemActions className="text-xs text-muted-foreground">
            {toPersianDigits(worlds.length)} جهان
            {/* rtl-ok: "forward" points left in an RTL layout. */}
            <ChevronLeft aria-hidden="true" className="size-4" />
          </ItemActions>
        </SheetTrigger>
      </Item>
      <SheetContent
        // rtl-ok: `side` names the physical edge the sheet rises from.
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 rounded-t-3xl border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="text-lg">جهان‌های هم‌داستان</SheetTitle>
          <SheetDescription>دنیای داستانی‌ات رو انتخاب کن</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-3 overflow-y-auto px-5 pb-2">
          {worlds.map((world) => (
            <li key={world.id}>
              <Link
                href={worldHref(world.slug)}
                aria-label={world.name}
                className="block overflow-hidden rounded-2xl border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Banner world={world} />
              </Link>
            </li>
          ))}
        </ul>
        <SheetFooter className="px-5">
          <SheetClose asChild>
            <Button variant="ghost" size="touch" className="w-full text-muted-foreground">
              بستن
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
