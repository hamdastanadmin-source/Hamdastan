'use client';

import { Check, Lock } from 'lucide-react';

import { AVATAR_CATALOG, type AvatarConfig, type AvatarSlot } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button, Tabs, TabsContent, TabsList, TabsTrigger, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { Screen, ScreenBack, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';

import { useAvatarStudio } from '../hooks/use-avatar-studio';
import { AvatarFigure } from './AvatarFigure';

/**
 * «آواتار من» — the full figure on top, updating as items are picked; the
 * categories as tabs; each category's items as tiles that preview the item
 * *on this avatar*.
 *
 * Selection is neutral: a foreground border, a lifted surface and a check —
 * never the brand. Violet is spent once, on «ذخیره».
 *
 * An item above the person's level (`unlockLevel`) is shown locked with the
 * level it needs. Nothing in today's catalog is, but the API already refuses
 * one, so the screen says why rather than failing on save.
 */

const TABS: ReadonlyArray<{ slot: AvatarSlot; label: string }> = [
  { slot: 'base', label: 'ظاهر' },
  { slot: 'top', label: 'بالاتنه' },
  { slot: 'bottom', label: 'شلوار' },
  { slot: 'shoes', label: 'کفش' },
  { slot: 'accessory', label: 'اکسسوری' },
];

function ItemGrid({
  slot,
  label,
  avatar,
  level,
  onChoose,
}: {
  slot: AvatarSlot;
  label: string;
  avatar: AvatarConfig;
  level: number;
  onChoose: (slot: AvatarSlot, itemId: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={avatar[slot]}
      // Radix answers '' when the selected tile is tapped again; a slot is never empty.
      onValueChange={(value) => value && onChoose(slot, value)}
      className="grid w-full grid-cols-3 gap-3"
    >
      {AVATAR_CATALOG[slot].map((item) => {
        const locked = (item.unlockLevel ?? 1) > level;
        return (
          <ToggleGroupItem
            key={item.id}
            value={item.id}
            disabled={locked}
            aria-label={locked ? `${item.label} — از سطح ${toPersianDigits(item.unlockLevel!)}` : item.label}
            className="group relative h-auto w-full flex-col gap-2 rounded-xl border border-border bg-card p-2 pb-2.5 font-normal hover:bg-accent/60 data-[state=on]:border-foreground data-[state=on]:bg-accent"
          >
            <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-secondary">
              <AvatarFigure avatar={{ ...avatar, [slot]: item.id }} frame={slot} label="" className="h-full w-full" />
            </span>
            <span className="text-xs">{item.label}</span>
            <span
              aria-hidden="true"
              className="absolute top-1.5 end-1.5 hidden size-5 items-center justify-center rounded-full bg-foreground text-background group-data-[state=on]:flex"
            >
              <Check className="size-3" strokeWidth={3} />
            </span>
            {locked && (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-xl bg-background/70 text-2xs text-muted-foreground">
                <Lock aria-hidden="true" className="size-4" />
                سطح {toPersianDigits(item.unlockLevel!)}
              </span>
            )}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export function AvatarStudio({ saved, level }: { saved: AvatarConfig | null; level: number }) {
  const { avatar, choose, changed, isSaving, save } = useAvatarStudio(saved);

  return (
    <Screen>
      <ScreenHeader>
        <ScreenBack href="/profile" />
      </ScreenHeader>

      <ScreenBody className="gap-6">
        <ScreenTitle title="آواتار من" description={saved ? undefined : 'لباس و استایلت رو انتخاب کن.'} />

        <div className="flex justify-center rounded-3xl border border-border bg-card py-6">
          <AvatarFigure
            avatar={avatar}
            className="h-64 w-auto animate-in fade-in duration-500 motion-reduce:animate-none"
          />
        </div>

        <Tabs defaultValue="top" className="gap-4">
          <TabsList variant="solid" className="grid w-full grid-cols-5">
            {TABS.map(({ slot, label }) => (
              <TabsTrigger key={slot} value={slot} className="px-1 text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TABS.map(({ slot, label }) => (
            <TabsContent key={slot} value={slot}>
              <ItemGrid slot={slot} label={label} avatar={avatar} level={level} onChoose={choose} />
            </TabsContent>
          ))}
        </Tabs>
      </ScreenBody>

      <ScreenFooter>
        <Button type="button" size="xl" className="w-full" disabled={!changed} loading={isSaving} onClick={() => void save()}>
          ذخیره
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
