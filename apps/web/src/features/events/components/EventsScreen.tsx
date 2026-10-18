'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { EventCard as EventCardData, EventCategory, Paginated, World } from '@hamdastan/types';
import { Button, Input, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';
import { Icon, type IconName } from '@hamdastan/ui/icons';

import { BottomNav, Screen, ScreenBody } from '@/components';

import { useDiscovery } from '../hooks/use-discovery';
import { dayTitle } from '../utils/dates';
import { sheetFilterCount, type DiscoveryState } from '../utils/filters';
import { CHIP } from './chip';
import { DateStrip } from './DateStrip';
import { EventCard } from './EventCard';
import { EventsEmpty } from './EventsEmpty';
import { FilterSheet } from './FilterSheet';

const SEARCH_DEBOUNCE_MS = 400;

/**
 * `/events`: discovering events. Search, category chips, the filters button
 * and a strip of days, the rest of the filters in a sheet; newest first — all of it in
 * the address, read by the server, which answers with what this person may
 * see. World-only and restricted events are the API's to include or not.
 */
export function EventsScreen({
  state,
  categories,
  worlds,
  result,
}: {
  state: DiscoveryState;
  categories: EventCategory[];
  worlds: World[];
  /** Null when the list could not be read. */
  result: Paginated<EventCardData> | null;
}) {
  const router = useRouter();
  const { apply, pending } = useDiscovery(state);
  const [search, setSearch] = useState(state.q ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chips = useRef<HTMLDivElement>(null);

  // A chosen category further along the row is scrolled into view, so it is seen to be on.
  useEffect(() => {
    chips.current?.querySelector('[data-state="on"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, []);
  const extra = sheetFilterCount(state);
  const filtered = Boolean(state.q || state.category?.length || state.date || extra);
  const pages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  // Typing is applied once it pauses.
  useEffect(() => {
    if (search.trim() === (state.q ?? '')) return;
    const timer = setTimeout(() => apply({ q: search.trim() || undefined }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [apply, search, state.q]);

  return (
    <Screen>
      {/* No visible title — the tab says where this is — but one h1 for screen readers. */}
      <h1 className="sr-only">رویدادها</h1>

      <ScreenBody className="gap-4 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="جست‌وجوی رویداد، مکان یا برگزارکننده"
            aria-label="جست‌وجوی رویدادها"
            className="h-12 ps-10"
          />
        </div>

        {categories.length > 0 && (
          <ToggleGroup
            ref={chips}
            type="multiple"
            value={state.category ?? []}
            onValueChange={(category) => apply({ category })}
            spacing={2}
            className="-mx-5 w-[calc(100%+2.5rem)] justify-start overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
            aria-label="دسته‌ها"
          >
            {categories.map((category) => (
              <ToggleGroupItem key={category.slug} value={category.slug} className={CHIP}>
                <Icon name={category.icon as IconName} aria-hidden="true" className="size-4" />
                {category.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}

        <DateStrip value={state.date} onChange={(date) => apply({ date })} filterCount={extra} onFilters={() => setFiltersOpen(true)} />

        <div className="flex items-center justify-between gap-3" aria-live="polite">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">{state.date ? dayTitle(state.date) : 'همه‌ی رویدادهای پیش‌رو'}</h2>
            {result && <span className="text-xs text-muted-foreground">{toPersianDigits(result.total)} رویداد</span>}
          </div>
          {filtered && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground"
              onClick={() => {
                setSearch('');
                apply({ q: undefined, category: [], date: undefined, type: [], world: undefined, city: undefined, price: undefined, available: undefined, interested: undefined });
              }}
            >
              پاک کردن همه
            </Button>
          )}
        </div>

        <div className={pending ? 'opacity-60 transition-opacity' : undefined} aria-busy={pending}>
          {!result ? (
            <EventsEmpty
              title="رویدادها باز نشدن"
              description="ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن."
              action={
                <Button variant="outline" onClick={() => router.refresh()}>
                  دوباره امتحان کن
                </Button>
              }
            />
          ) : result.items.length === 0 ? (
            <EventsEmpty
              title={filtered ? 'رویدادی با این مشخصات پیدا نشد' : 'فعلاً رویداد پیش‌رویی نیست'}
              description={filtered ? 'فیلترها یا روز دیگه‌ای رو امتحان کن.' : 'رویدادهای تازه همین‌جا میان.'}
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {result.items.map((card) => (
                <li key={card.id}>
                  <EventCard card={card} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {result && pages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" disabled={(state.page ?? 1) <= 1 || pending} onClick={() => apply({ page: (state.page ?? 1) - 1 })}>
              <ChevronRight aria-hidden="true" />
              قبلی
            </Button>
            <span className="text-sm text-muted-foreground">
              {toPersianDigits(state.page ?? 1)} از {toPersianDigits(pages)}
            </span>
            <Button variant="outline" size="sm" disabled={(state.page ?? 1) >= pages || pending} onClick={() => apply({ page: (state.page ?? 1) + 1 })}>
              بعدی
              <ChevronLeft aria-hidden="true" />
            </Button>
          </div>
        )}
      </ScreenBody>

      <FilterSheet open={filtersOpen} onOpenChange={setFiltersOpen} state={state} worlds={worlds} onApply={apply} />
      <BottomNav />
    </Screen>
  );
}
