'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Plus, Search, Tags } from 'lucide-react';
import { toast } from 'sonner';

import { EVENT_TYPE_LABELS, EVENT_VISIBILITY_LABELS, EVENT_VISIBILITIES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminEventSummary, EventStatus, EventStatusAction, EventStatusInput, EventVisibility } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { errorMessage, formatCount, formatDateTime } from '@/lib';

import { useEventOptions } from '../hooks/use-event-options';
import { useEvents } from '../hooks/use-events';
import { STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { EventActionsMenu } from './EventActionsMenu';
import { EventStatusDialog } from './EventStatusDialog';

const ALL = 'all';
const COLUMNS = 7;

/**
 * Every event, with where it stands and where it shows, and the actions on
 * it. Publishing from here asks when; a problem that blocks it sends the
 * admin to the editor, which says what is missing.
 */
export function EventsScreen() {
  const router = useRouter();
  const can = useAdminCan();
  const { categories, worlds } = useEventOptions();
  const { filters, setFilters, page, setPage, data, loading, error, reload, changeStatus, duplicate } = useEvents();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ event: AdminEventSummary; action: EventStatusAction } | null>(null);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstLoad = loading && !data;
  const filtered = Boolean(filters.search || filters.status || filters.visibility || filters.world || filters.category);

  const runStatus = async (event: AdminEventSummary, input: EventStatusInput) => {
    setPendingId(event.id);
    try {
      const updated = await changeStatus(event.id, input);
      toast.success(`«${event.title}» ${STATUS_LABELS[updated.status]} شد`);
    } catch (caught) {
      toast.error(errorMessage(caught), {
        action: { label: 'باز کردن', onClick: () => router.push(`/events/${event.id}/edit?tab=publish`) },
      });
    } finally {
      setPendingId(null);
    }
  };

  const onDuplicate = async (event: AdminEventSummary) => {
    setPendingId(event.id);
    try {
      const copy = await duplicate(event.id);
      toast.success('یک نسخه‌ی پیش‌نویس ساخته شد');
      router.push(`/events/${copy.id}/edit`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  const select = <T extends string>(value: T | undefined, label: string, all: string, options: { value: T; label: string }[], onChange: (value: T | undefined) => void, width = 'w-40') => (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : (next as T))}>
      <SelectTrigger className={width} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{all}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">رویدادها</h1>
          <p className="mt-1 text-sm text-muted-foreground">رویداد بساز، به دنیاها وصلش کن، منتشرش کن و ثبت‌نام‌ها و خریدها رو دنبال کن.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/events/categories">
              <Tags aria-hidden="true" />
              دسته‌بندی‌ها
            </Link>
          </Button>
          {can('events.write') && (
            <Button asChild>
              <Link href="/events/new">
                <Plus aria-hidden="true" />
                رویداد جدید
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="جستجوی عنوان، نامک یا برگزارکننده"
              aria-label="جستجوی رویدادها"
              className="ps-9"
            />
          </div>
          {select<EventStatus>(
            filters.status,
            'وضعیت',
            'همه‌ی وضعیت‌ها',
            (Object.keys(STATUS_LABELS) as EventStatus[]).map((value) => ({ value, label: STATUS_LABELS[value] })),
            (status) => setFilters({ ...filters, status })
          )}
          {select<EventVisibility>(
            filters.visibility,
            'محل نمایش',
            'هر محل نمایش',
            EVENT_VISIBILITIES.map((value) => ({ value, label: EVENT_VISIBILITY_LABELS[value] })),
            (visibility) => setFilters({ ...filters, visibility })
          )}
          {select(filters.world, 'دنیا', 'همه‌ی دنیاها', worlds.map((world) => ({ value: world.id, label: world.name })), (world) => setFilters({ ...filters, world }), 'w-36')}
          {select(
            filters.category,
            'دسته',
            'همه‌ی دسته‌ها',
            categories.map((category) => ({ value: category.id, label: category.name })),
            (category) => setFilters({ ...filters, category }),
            'w-36'
          )}
          <Select value={filters.sort} onValueChange={(sort) => setFilters({ ...filters, sort: sort as 'updated' | 'start' })}>
            <SelectTrigger className="w-40" aria-label="مرتب‌سازی">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">آخرین تغییر</SelectItem>
              <SelectItem value="start">زمان شروع</SelectItem>
            </SelectContent>
          </Select>
          {data && (
            <p className="ms-auto text-sm text-muted-foreground" aria-live="polite">
              {toPersianDigits(data.total)} رویداد
            </p>
          )}
        </CardContent>

        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>فهرست رویدادها بارگذاری نشد</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
                  تلاش دوباره
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <Table aria-busy={loading} className={loading && data ? 'opacity-60 transition-opacity' : undefined}>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">عنوان</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead className="hidden lg:table-cell">دنیا و دسته</TableHead>
                <TableHead className="hidden md:table-cell">شروع</TableHead>
                <TableHead className="hidden xl:table-cell">برگزارکننده</TableHead>
                <TableHead className="hidden sm:table-cell">علاقه / رزرو</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">عملیات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {firstLoad &&
                Array.from({ length: 5 }, (_, row) => (
                  <TableRow key={row}>
                    {Array.from({ length: COLUMNS }, (_, cell) => (
                      <TableCell key={cell}>
                        <Skeleton className="h-5 w-full max-w-28" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CalendarDays aria-hidden="true" className="size-8" />
                      {filtered ? 'رویدادی با این مشخصات پیدا نشد' : 'هنوز رویدادی نساختی'}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="min-w-40 whitespace-normal ps-4">
                    <Link href={`/events/${event.id}/edit`} className="font-medium hover:underline">
                      {event.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{EVENT_TYPE_LABELS[event.type]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[event.status]}>{STATUS_LABELS[event.status]}</Badge>
                    <span className="mt-1 block text-xs text-muted-foreground">{EVENT_VISIBILITY_LABELS[event.visibility]}</span>
                    {event.status === 'scheduled' && (
                      <span className="block text-xs text-muted-foreground">{formatDateTime(event.publishAt)}</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-56 whitespace-normal text-sm lg:table-cell">
                    {event.worlds.map((world) => world.name).join('، ') || '—'}
                    <span className="block text-xs text-muted-foreground">{event.categories.map((category) => category.name).join('، ')}</span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDateTime(event.startAt)}</TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">{event.organizerName || '—'}</TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {formatCount(event.interestCount)} / {formatCount(event.bookingCount)}
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    <EventActionsMenu
                      event={event}
                      disabled={pendingId === event.id}
                      onStatus={(action) => setConfirming({ event, action })}
                      onDuplicate={() => onDuplicate(event)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data && totalPages > 1 && (
          <CardContent className="flex items-center justify-between gap-3 border-t p-4">
            <p className="text-sm text-muted-foreground">
              صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                <ChevronRight aria-hidden="true" />
                قبلی
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
                بعدی
                <ChevronLeft aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <EventStatusDialog
        key={confirming ? `${confirming.event.id}-${confirming.action}` : 'none'}
        pending={confirming && { action: confirming.action, title: confirming.event.title }}
        onCancel={() => setConfirming(null)}
        onConfirm={async (input) => {
          if (confirming) await runStatus(confirming.event, input);
          setConfirming(null);
        }}
      />
    </div>
  );
}
