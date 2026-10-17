'use client';

import { useState } from 'react';

import { EVENT_TYPE_LABELS, EVENT_TYPES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { EventType, World } from '@hamdastan/types';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { useEventCount } from '../hooks/use-event-count';
import type { DiscoveryState } from '../utils/filters';
import { CHIP } from './chip';

const ALL = 'all';

/**
 * The filters that do not fit on the screen, in a bottom sheet: type, world,
 * city, price, «still open», «my interested». Nothing changes until
 * «نمایش»; the button says how many events the choice would show, counted
 * by the API.
 */
export function FilterSheet({
  open,
  onOpenChange,
  state,
  worlds,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DiscoveryState;
  worlds: World[];
  onApply: (patch: Partial<DiscoveryState>) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // rtl-ok: `side` names the physical edge the sheet rises from.
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mounted per opening, so it starts from what is applied. */}
        {open && <FilterForm state={state} worlds={worlds} onApply={(patch) => {
              onApply(patch);
              onOpenChange(false);
            }} onCancel={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

const CLEARED: Partial<DiscoveryState> = {
  type: [],
  world: undefined,
  city: undefined,
  price: undefined,
  available: undefined,
  interested: undefined,
};

function FilterForm({
  state,
  worlds,
  onApply,
  onCancel,
}: {
  state: DiscoveryState;
  worlds: World[];
  onApply: (patch: Partial<DiscoveryState>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<DiscoveryState>(state);
  const set = (patch: Partial<DiscoveryState>) => setDraft((current) => ({ ...current, ...patch }));
  const count = useEventCount(draft, true);
  const patch: Partial<DiscoveryState> = {
    type: draft.type,
    world: draft.world,
    city: draft.city?.trim() || undefined,
    price: draft.price,
    available: draft.available,
    interested: draft.interested,
  };

  return (
    <div className="flex flex-col">
      <SheetHeader className="px-5 pt-6">
        <SheetTitle className="text-lg">فیلترها</SheetTitle>
        <SheetDescription>با دسته‌ها و تاریخ صفحه با هم اعمال می‌شن.</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-5 py-2">
        <div className="flex flex-col gap-2">
          <Label>نوع رویداد</Label>
          <ToggleGroup
            type="multiple"
            value={draft.type ?? []}
            onValueChange={(type) => set({ type: type as EventType[] })}
            spacing={2}
            className="flex-wrap"
            aria-label="نوع رویداد"
          >
            {EVENT_TYPES.map((type) => (
              <ToggleGroupItem key={type} value={type} className={CHIP}>
                {EVENT_TYPE_LABELS[type]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {worlds.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="filter-world">دنیا</Label>
            <Select value={draft.world ?? ALL} onValueChange={(world) => set({ world: world === ALL ? undefined : world })}>
              <SelectTrigger id="filter-world" className="h-12 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه‌ی دنیاها</SelectItem>
                {worlds.map((world) => (
                  <SelectItem key={world.slug} value={world.slug}>
                    {world.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="filter-city">شهر</Label>
          <Input id="filter-city" className="h-12" placeholder="مثلاً تهران" value={draft.city ?? ''} onChange={(event) => set({ city: event.target.value })} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>قیمت</Label>
          <ToggleGroup
            type="single"
            value={draft.price ?? ALL}
            onValueChange={(price) => price && set({ price: price === ALL ? undefined : (price as 'free' | 'paid') })}
            spacing={2}
            aria-label="قیمت"
          >
            <ToggleGroupItem value={ALL} className={CHIP}>
              همه
            </ToggleGroupItem>
            <ToggleGroupItem value="free" className={CHIP}>
              رایگان
            </ToggleGroupItem>
            <ToggleGroupItem value="paid" className={CHIP}>
              پولی
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <Label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 font-normal">
          <span className="flex flex-col gap-1">
            <span className="font-medium">هنوز می‌شه شرکت کرد</span>
            <span className="text-xs text-muted-foreground">تموم‌نشده، با جای خالی و ثبت‌نام باز</span>
          </span>
          <Switch checked={draft.available ?? false} onCheckedChange={(available) => set({ available: available || undefined })} />
        </Label>

        <Label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4 font-normal">
          <span className="font-medium">فقط علاقه‌مندی‌های من</span>
          <Switch checked={draft.interested ?? false} onCheckedChange={(interested) => set({ interested: interested || undefined })} />
        </Label>
      </div>

      <SheetFooter className="gap-2 px-5 pb-5">
        <Button size="xl" className="w-full" onClick={() => onApply(patch)}>
          {count === null ? 'نمایش رویدادها' : count === 0 ? 'رویدادی پیدا نمی‌شه' : `نمایش ${toPersianDigits(count)} رویداد`}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="touch" className="flex-1 text-muted-foreground" onClick={() => setDraft({ ...draft, ...CLEARED })}>
            پاک کردن فیلترها
          </Button>
          <Button variant="ghost" size="touch" className="flex-1 text-muted-foreground" onClick={onCancel}>
            انصراف
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
