'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, CircleAlert, Plus, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { ACTIVITY_TYPE_LABELS, ACTIVITY_TYPES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityStatus, ActivityStatusAction, ActivityType, AdminActivitySummary } from '@hamdastan/types';
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

import { errorMessage, formatCount, formatDate, formatPercent } from '@/lib';

import { useActivities } from '../hooks/use-activities';
import { CONFIRM_COPY, describeAudience, STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { ActivityActionsMenu } from './ActivityActionsMenu';
import { StatusActionDialog } from './StatusActionDialog';

const ALL = 'all';
const COLUMNS = 8;

/**
 * Engagement Studio's home: every activity with its audience, its figures
 * and its reward, and the actions on it. All figures are the API's — the
 * eligible count is the audience as it stands today, the XP paid is the
 * ledger's net sum.
 */
export function ActivitiesScreen() {
  const router = useRouter();
  const { filters, setFilters, page, setPage, data, loading, error, reload, changeStatus, duplicate } = useActivities();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ activity: AdminActivitySummary; action: ActivityStatusAction } | null>(
    null
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstLoad = loading && !data;

  const runStatus = async (activity: AdminActivitySummary, action: ActivityStatusAction) => {
    setPendingId(activity.id);
    try {
      const updated = await changeStatus(activity.id, action);
      toast.success(`«${activity.title}» ${STATUS_LABELS[updated.status]} شد`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  const onStatus = (activity: AdminActivitySummary, action: ActivityStatusAction) =>
    CONFIRM_COPY[action] ? setConfirming({ activity, action }) : runStatus(activity, action);

  const onDuplicate = async (activity: AdminActivitySummary) => {
    setPendingId(activity.id);
    try {
      const copy = await duplicate(activity.id);
      toast.success('یک نسخه‌ی پیش‌نویس ساخته شد');
      router.push(`/engagement/${copy.id}/edit`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">استودیو</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرسنجی، مأموریت و آزمون بساز، برای کاربرها منتشر کن و نتیجه و XP رو دنبال کن.
          </p>
        </div>
        <Button asChild>
          <Link href="/engagement/new">
            <Plus aria-hidden="true" />
            فعالیت جدید
          </Link>
        </Button>
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground"
            />
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="جستجوی عنوان"
              aria-label="جستجوی فعالیت‌ها"
              className="ps-9"
            />
          </div>
          <Select
            value={filters.status ?? ALL}
            onValueChange={(value) =>
              setFilters({ ...filters, status: value === ALL ? undefined : (value as ActivityStatus) })
            }
          >
            <SelectTrigger className="w-40" aria-label="وضعیت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه‌ی وضعیت‌ها</SelectItem>
              {(Object.keys(STATUS_LABELS) as ActivityStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.type ?? ALL}
            onValueChange={(value) =>
              setFilters({ ...filters, type: value === ALL ? undefined : (value as ActivityType) })
            }
          >
            <SelectTrigger className="w-36" aria-label="نوع">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه‌ی انواع</SelectItem>
              {ACTIVITY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {ACTIVITY_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <p className="ms-auto text-sm text-muted-foreground" aria-live="polite">
              {toPersianDigits(data.total)} فعالیت
            </p>
          )}
        </CardContent>

        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>فهرست فعالیت‌ها بارگذاری نشد</AlertTitle>
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
                <TableHead className="hidden xl:table-cell">مخاطبان</TableHead>
                <TableHead className="hidden lg:table-cell">پاسخ / تکمیل</TableHead>
                <TableHead className="hidden lg:table-cell">مشارکت</TableHead>
                <TableHead className="hidden sm:table-cell">XP</TableHead>
                <TableHead className="hidden xl:table-cell">انتشار / پایان</TableHead>
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
                      <Sparkles aria-hidden="true" className="size-8" />
                      {filters.search || filters.status || filters.type
                        ? 'فعالیتی با این مشخصات پیدا نشد'
                        : 'هنوز فعالیتی نساختی'}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="min-w-40 whitespace-normal ps-4">
                    <Link href={`/engagement/${activity.id}`} className="font-medium hover:underline">
                      {activity.title}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ACTIVITY_TYPE_LABELS[activity.type]} · نسخه‌ی {toPersianDigits(activity.version)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[activity.status]}>{STATUS_LABELS[activity.status]}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm xl:table-cell">
                    {describeAudience(activity.audience)}
                    <span className="block text-xs text-muted-foreground">
                      {formatCount(activity.stats.eligible)} نفر واجد شرایط
                    </span>
                  </TableCell>
                  <TableCell className="hidden tabular-nums lg:table-cell">
                    {formatCount(activity.stats.responses)} / {formatCount(activity.stats.completed)}
                  </TableCell>
                  <TableCell className="hidden tabular-nums lg:table-cell">
                    {formatPercent(activity.stats.participationRate)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="tabular-nums">
                      {activity.xpAmount === null ? '—' : formatCount(activity.xpAmount)}
                    </span>
                    <span className="block text-xs text-muted-foreground tabular-nums">
                      {formatCount(activity.stats.xpAwarded)} داده‌شده
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                    {formatDate(activity.startsAt ?? activity.publishedAt)}
                    <span className="block">{activity.endsAt ? formatDate(activity.endsAt) : 'بدون پایان'}</span>
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    <ActivityActionsMenu
                      activity={activity}
                      disabled={pendingId === activity.id}
                      onStatus={(action) => onStatus(activity, action)}
                      onDuplicate={() => onDuplicate(activity)}
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
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage(page + 1)}
              >
                بعدی
                <ChevronLeft aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <StatusActionDialog
        pending={confirming && { action: confirming.action, title: confirming.activity.title }}
        onCancel={() => setConfirming(null)}
        onConfirm={async (action) => {
          if (confirming) await runStatus(confirming.activity, action);
          setConfirming(null);
        }}
      />
    </div>
  );
}
