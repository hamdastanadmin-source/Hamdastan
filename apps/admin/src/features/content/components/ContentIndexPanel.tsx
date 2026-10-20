'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, CircleAlert, FileText, Plus, Search } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { CONTENT_STATUSES, CONTENT_TYPES, type AdminPermission, type ContentStatus, type ContentType } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { formatDateTime } from '@/lib';

import { useContentIndex } from '../hooks/use-content-index';
import { CONTENT_STATUS_BADGE, CONTENT_STATUS_LABELS, CONTENT_TYPE_LABELS, editHref } from '../utils/labels';

const ALL = 'all';
const COLUMNS = 5;

/** What «ایجاد» offers, the editor each opens, and who may. Inside a world, the world comes along. */
const CREATE: { type: ContentType; href: string; permission: AdminPermission }[] = [
  { type: 'news', href: '/content/articles/new?kind=news', permission: 'content.write' },
  { type: 'knowledge', href: '/content/articles/new?kind=knowledge', permission: 'content.write' },
  { type: 'event', href: '/events/new?', permission: 'events.write' },
  { type: 'activity', href: '/engagement/new?', permission: 'activities.write' },
];

const withWorld = (href: string, worldId: string | undefined) =>
  worldId ? `${href}${href.endsWith('?') ? '' : '&'}world=${worldId}` : href.replace(/\?$/, '');

/**
 * Everything filed under worlds — articles, events, activities — in one
 * list: search, type, status and world filters, and «ایجاد» for each kind.
 * Opened inside a world (`world`), it lists only that world's content and a
 * new item starts filed under it.
 */
export function ContentIndexPanel({ world, worlds = [] }: { world?: { id: string; name: string }; worlds?: { id: string; name: string }[] }) {
  const can = useAdminCan();
  const { filters, setFilters, page, setPage, data, loading, error, reload } = useContentIndex({ world: world?.id });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstLoad = loading && !data;
  const filtered = Boolean(filters.q || filters.type || filters.status || filters.world);
  const creatable = CREATE.filter((item) => can(item.permission));

  const select = <T extends string>(value: T | undefined, label: string, all: string, options: { value: T; label: string }[], onChange: (value: T | undefined) => void) => (
    <Select value={value ?? ALL} onValueChange={(next) => onChange(next === ALL ? undefined : (next as T))}>
      <SelectTrigger className="w-36" aria-label={label}>
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
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative w-full sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
          <Input
            type="search"
            value={filters.q}
            onChange={(event) => setFilters({ ...filters, q: event.target.value })}
            placeholder="جست‌وجوی عنوان"
            aria-label="جست‌وجوی محتوا"
            className="ps-9"
          />
        </div>
        {select<ContentType>(
          filters.type,
          'نوع',
          'همه‌ی انواع',
          CONTENT_TYPES.map((value) => ({ value, label: CONTENT_TYPE_LABELS[value] })),
          (type) => setFilters({ ...filters, type })
        )}
        {select<ContentStatus>(
          filters.status,
          'وضعیت',
          'همه‌ی وضعیت‌ها',
          CONTENT_STATUSES.map((value) => ({ value, label: CONTENT_STATUS_LABELS[value] })),
          (status) => setFilters({ ...filters, status })
        )}
        {!world &&
          select(
            filters.world,
            'دنیا',
            'همه‌ی دنیاها',
            worlds.map((item) => ({ value: item.id, label: item.name })),
            (next) => setFilters({ ...filters, world: next })
          )}
        <div className="ms-auto flex items-center gap-3">
          {data && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {toPersianDigits(data.total)} مورد
            </p>
          )}
          {creatable.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus aria-hidden="true" />
                  ایجاد
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-40">
                {creatable.map((item) => (
                  <DropdownMenuItem key={item.type} asChild>
                    <Link href={withWorld(item.href, world?.id)}>{CONTENT_TYPE_LABELS[item.type]}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>

      {error ? (
        <div className="p-4">
          <Alert variant="destructive">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>فهرست محتوا بارگذاری نشد</AlertTitle>
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
              <TableHead>نوع</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="hidden md:table-cell">دنیاها</TableHead>
              <TableHead className="hidden pe-4 sm:table-cell">آخرین تغییر</TableHead>
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
                    <FileText aria-hidden="true" className="size-8" />
                    {filtered ? 'محتوایی با این مشخصات پیدا نشد' : world ? 'هنوز محتوایی به این دنیا متصل نشده است' : 'هنوز محتوایی ساخته نشده است'}
                  </div>
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((item) => (
              <TableRow key={`${item.type}-${item.id}`}>
                <TableCell className="min-w-40 whitespace-normal ps-4">
                  <Link href={editHref(item.type, item.id)} className="font-medium hover:underline">
                    {item.title || 'بدون عنوان'}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{CONTENT_TYPE_LABELS[item.type]}</TableCell>
                <TableCell>
                  <Badge variant={CONTENT_STATUS_BADGE[item.status]}>{CONTENT_STATUS_LABELS[item.status]}</Badge>
                </TableCell>
                <TableCell className="hidden max-w-56 whitespace-normal text-sm md:table-cell">
                  {item.worlds.map((entry) => entry.name).join('، ') || '—'}
                </TableCell>
                <TableCell className="hidden pe-4 text-sm text-muted-foreground sm:table-cell">{formatDateTime(item.updatedAt)}</TableCell>
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
  );
}
