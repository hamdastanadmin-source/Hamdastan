'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

import type { FormStatus, FormTemplate, FormsQuery } from '@hamdastan/types';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';

import { CreateFormDialog } from './CreateFormDialog';

/**
 * Search, filter, sort, and the button that starts a new form.
 *
 * All three narrowing controls put their value in the URL rather than in
 * component state: the list is fetched on the server, so the address is what
 * decides what is on screen — which also makes a filtered view shareable and
 * survivable across a reload.
 */

const STATUS_LABELS: Record<FormStatus | 'ALL', string> = {
  ALL: 'همهٔ وضعیت‌ها',
  DRAFT: 'پیش‌نویس',
  PUBLISHED: 'منتشرشده',
  CLOSED: 'بسته‌شده',
};

const SORT_LABELS: Record<NonNullable<FormsQuery['sort']>, string> = {
  RECENT: 'آخرین تغییر',
  TITLE: 'عنوان',
  RESPONSES: 'بیشترین پاسخ',
};

export function FormsToolbar({
  query,
  templates,
}: {
  query: FormsQuery;
  templates: FormTemplate[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(query.search ?? '');
  const canCreate = useHasPermission('forms.create');

  /** Rewrites one query parameter, always returning to the first page. */
  const apply = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}?${next.toString()}`);
  };

  // Debounced, so a five-letter search is one request rather than five. The
  // rewrite is inlined rather than calling `apply`, which is rebuilt on every
  // render and would restart the timer with each keystroke.
  useEffect(() => {
    if (term === (query.search ?? '')) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (term) next.set('search', term);
      else next.delete('search');
      next.delete('page');
      router.replace(`${pathname}?${next.toString()}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [term, query.search, params, pathname, router]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="search"
            type="search"
            placeholder="جستجوی عنوان فرم"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="ps-9"
          />
        </div>

        <Select
          value={query.status ?? 'ALL'}
          onValueChange={(value) => apply('status', value === 'ALL' ? null : value)}
        >
          <SelectTrigger aria-label="وضعیت" className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.sort ?? 'RECENT'}
          onValueChange={(value) => apply('sort', value === 'RECENT' ? null : value)}
        >
          <SelectTrigger aria-label="ترتیب" className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canCreate && <CreateFormDialog templates={templates} />}
    </div>
  );
}
