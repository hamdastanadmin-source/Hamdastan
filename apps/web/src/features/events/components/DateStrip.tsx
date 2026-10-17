'use client';

import { SlidersHorizontal } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { Button, ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { addDays, dayKeyOf, stripLabels } from '../utils/dates';
import { DAY_CHIP } from './chip';

const DAYS = 14;
const ALL = 'all';

/**
 * The filters button, then the next two weeks as a row of days: one tap
 * narrows the list to a day, «همه» takes it back. Today is the first day, in
 * Tehran. The button reads as on, with how many, while the sheet's filters
 * narrow the list.
 */
export function DateStrip({
  value,
  onChange,
  filterCount,
  onFilters,
}: {
  value: string | undefined;
  onChange: (date: string | undefined) => void;
  filterCount: number;
  onFilters: () => void;
}) {
  const today = dayKeyOf(new Date());
  const days = Array.from({ length: DAYS }, (_, index) => addDays(today, index));

  return (
    <div className="-mx-5 flex items-center gap-2 ps-5">
      <Button
        variant="outline"
        aria-label={filterCount > 0 ? `فیلترها، ${toPersianDigits(filterCount)} فعال` : 'فیلترها'}
        className={cn('relative h-14 w-12 shrink-0 rounded-2xl', filterCount > 0 && 'border-primary bg-primary/10 text-primary')}
        onClick={onFilters}
      >
        <SlidersHorizontal aria-hidden="true" className="size-5" />
        {filterCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -end-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-2xs font-semibold text-primary-foreground"
          >
            {toPersianDigits(filterCount)}
          </span>
        )}
      </Button>

      <ToggleGroup
        type="single"
        value={value && days.includes(value) ? value : (value ?? ALL)}
        onValueChange={(next) => next && onChange(next === ALL ? undefined : next)}
        spacing={2}
        className="min-w-0 flex-1 justify-start overflow-x-auto pe-5 pb-1 pt-1.5 [scrollbar-width:none]"
        aria-label="روز"
      >
        <ToggleGroupItem value={ALL} className={cn(DAY_CHIP, 'px-4')}>
          همه
        </ToggleGroupItem>
        {days.map((day, index) => {
          const { weekday, day: number } = stripLabels(day);
          return (
            <ToggleGroupItem
              key={day}
              value={day}
              aria-label={index === 0 ? `امروز، ${weekday} ${number}` : `${weekday} ${number}`}
              className={cn(DAY_CHIP, 'flex w-12 flex-col gap-0.5 px-0')}
            >
              <span className="text-2xs opacity-70">{index === 0 ? 'امروز' : weekday}</span>
              <span className="text-base font-semibold">{number}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}
