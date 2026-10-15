'use client';

import { Search } from 'lucide-react';

import { MEDIA_CATEGORIES, MEDIA_CATEGORY_LABELS } from '@hamdastan/config';
import type { MediaCategory, MediaKind } from '@hamdastan/types';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hamdastan/ui';

import type { MediaFilters as Filters } from '../hooks/use-media-library';

const ALL = 'all';

/** Search, shelf and kind — the library's and the picker's one filter bar. */
export function MediaFilters({
  filters,
  onChange,
  lockKind,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
  /** The picker for an image's place offers images only. */
  lockKind?: MediaKind;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="جست‌وجوی نام"
          aria-label="جست‌وجوی نام"
          className="ps-9"
        />
      </div>
      <Select
        value={filters.category ?? ALL}
        onValueChange={(value) => onChange({ ...filters, category: value === ALL ? undefined : (value as MediaCategory) })}
      >
        <SelectTrigger className="w-full sm:w-40" aria-label="دسته">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>همه‌ی دسته‌ها</SelectItem>
          {MEDIA_CATEGORIES.map((id) => (
            <SelectItem key={id} value={id}>
              {MEDIA_CATEGORY_LABELS[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!lockKind && (
        <Select
          value={filters.kind ?? ALL}
          onValueChange={(value) => onChange({ ...filters, kind: value === ALL ? undefined : (value as MediaKind) })}
        >
          <SelectTrigger className="w-full sm:w-32" aria-label="نوع">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه</SelectItem>
            <SelectItem value="image">تصویر</SelectItem>
            <SelectItem value="motion">موشن</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
