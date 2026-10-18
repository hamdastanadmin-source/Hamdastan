'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellOff, ChevronLeft, ChevronRight, CircleAlert, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminCampaignSummary, CampaignStatus } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { adminNotificationsService } from '@/services';

import { useCampaigns } from '../hooks/use-campaigns';
import { CATEGORY_LABELS, describeAudience, STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { CampaignActionsMenu, type CampaignRowAction } from './CampaignActionsMenu';

const ALL = 'all';
const COLUMNS = 7;

const CONFIRM: Record<Exclude<CampaignRowAction, 'duplicate'>, { title: string; body: string; button: string }> = {
  cancel: {
    title: 'لغو ارسال',
    body: 'این کمپین ارسال نمی‌شه و دیگه نمی‌شه دوباره زمان‌بندیش کرد؛ برای ارسال بعدی، تکثیرش کن.',
    button: 'لغو ارسال',
  },
  archive: {
    title: 'بایگانی',
    body: 'از فهرست اصلی کنار می‌ره. اعلان‌هایی که قبلاً ارسال شدن سر جاشون می‌مونن.',
    button: 'بایگانی',
  },
};

/**
 * The notification campaigns: the figures (by status, recipients, pushes
 * accepted by the push service), a searchable list, and the row actions.
 * Sending and scheduling happen on a campaign's own screen, after its
 * preview and a confirmation.
 */
export function CampaignsScreen() {
  const router = useRouter();
  const can = useAdminCan();
  const { filters, setFilters, page, setPage, data, overview, loading, error, reload } = useCampaigns();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ campaign: AdminCampaignSummary; action: 'cancel' | 'archive' } | null>(null);
  const [busy, setBusy] = useState(false);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const firstLoad = loading && !data;

  const onAction = async (campaign: AdminCampaignSummary, action: CampaignRowAction) => {
    if (action !== 'duplicate') return setConfirming({ campaign, action });
    setPendingId(campaign.id);
    try {
      const copy = await adminNotificationsService.duplicate(campaign.id);
      toast.success('یک پیش‌نویس تازه ساخته شد');
      router.push(`/notifications/${copy.id}`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const { campaign, action } = confirming;
      await (action === 'cancel' ? adminNotificationsService.cancel(campaign.id) : adminNotificationsService.archive(campaign.id));
      toast.success(action === 'cancel' ? 'ارسال لغو شد' : 'بایگانی شد');
      setConfirming(null);
      reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const figures: { label: string; value: string }[] = overview
    ? [
        { label: 'همه‌ی کمپین‌ها', value: formatCount(overview.total) },
        { label: 'پیش‌نویس', value: formatCount(overview.byStatus.draft) },
        { label: 'زمان‌بندی‌شده', value: formatCount(overview.byStatus.scheduled + overview.byStatus.sending) },
        { label: 'ارسال‌شده', value: formatCount(overview.byStatus.sent) },
        { label: 'ناموفق', value: formatCount(overview.byStatus.failed) },
        { label: 'اعلان‌های ساخته‌شده', value: formatCount(overview.recipients) },
        overview.push.available
          ? { label: 'پوش پذیرفته / رد', value: `${formatCount(overview.push.sent)} / ${formatCount(overview.push.failed)}` }
          : { label: 'اعلان گوشی', value: 'پیکربندی نشده' },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">اعلان‌ها</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            اعلان بنویس، مخاطبش رو انتخاب کن، پیش‌نمایش ببین و همین حالا یا در زمان دلخواه بفرستش.
          </p>
        </div>
        {can('notifications.write') && (
          <Button asChild>
            <Link href="/notifications/new">
              <Plus aria-hidden="true" />
              اعلان جدید
            </Link>
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {(figures.length ? figures : Array.from({ length: 7 }, () => null)).map((figure, index) => (
          <Card key={figure?.label ?? index} className="py-0">
            <CardContent className="flex flex-col gap-1 p-4">
              {figure ? (
                <>
                  <dt className="text-xs text-muted-foreground">{figure.label}</dt>
                  <dd className="text-lg font-bold tabular-nums">{figure.value}</dd>
                </>
              ) : (
                <Skeleton className="h-11 w-full" />
              )}
            </CardContent>
          </Card>
        ))}
      </dl>
      {overview && overview.push.available && (
        <p className="-mt-3 text-xs text-muted-foreground">
          «پذیرفته» یعنی سرویس پوشِ مرورگر پیام رو گرفت؛ نشون‌دادنش روی گوشی قابل تأیید نیست.
        </p>
      )}

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative w-full sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
            <Input
              type="search"
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              placeholder="جستجوی عنوان یا متن"
              aria-label="جستجوی کمپین‌ها"
              className="ps-9"
            />
          </div>
          <Select
            value={filters.status ?? ALL}
            onValueChange={(next) => setFilters({ ...filters, status: next === ALL ? undefined : (next as CampaignStatus) })}
          >
            <SelectTrigger className="w-44" aria-label="وضعیت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>همه (بدون بایگانی)</SelectItem>
              {(Object.keys(STATUS_LABELS) as CampaignStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {data && (
            <p className="ms-auto text-sm text-muted-foreground" aria-live="polite">
              {toPersianDigits(data.total)} کمپین
            </p>
          )}
        </CardContent>

        {error ? (
          <div className="p-4">
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>فهرست کمپین‌ها بارگذاری نشد</AlertTitle>
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
                <TableHead className="hidden lg:table-cell">مخاطب</TableHead>
                <TableHead className="hidden md:table-cell">کانال</TableHead>
                <TableHead className="hidden md:table-cell">زمان ارسال</TableHead>
                <TableHead className="hidden xl:table-cell">ساخته‌شده</TableHead>
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
                      <BellOff aria-hidden="true" className="size-8" />
                      {filters.search || filters.status ? 'کمپینی با این مشخصات پیدا نشد' : 'هنوز اعلانی نساختی'}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {data?.items.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="min-w-44 whitespace-normal ps-4">
                    <Link href={`/notifications/${campaign.id}`} className="font-medium hover:underline">
                      {campaign.title || 'بدون عنوان'}
                    </Link>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{CATEGORY_LABELS[campaign.category]}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[campaign.status]}>{STATUS_LABELS[campaign.status]}</Badge>
                    {campaign.recipientCount !== null && (
                      <span className="mt-1 block text-xs text-muted-foreground">{formatCount(campaign.recipientCount)} گیرنده</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-60 whitespace-normal text-sm lg:table-cell">{describeAudience(campaign.audience)}</TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{campaign.push ? 'درون برنامه + گوشی' : 'درون برنامه'}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDateTime(campaign.sentAt ?? campaign.scheduledAt)}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                    {formatDateTime(campaign.createdAt)}
                    <span className="block text-xs">{campaign.createdBy ?? '—'}</span>
                  </TableCell>
                  <TableCell className="pe-4 text-end">
                    <CampaignActionsMenu campaign={campaign} disabled={pendingId === campaign.id} onAction={(action) => onAction(campaign, action)} />
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

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && !busy && setConfirming(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{confirming && `${CONFIRM[confirming.action].title} «${confirming.campaign.title || 'بدون عنوان'}»`}</DialogTitle>
            <DialogDescription>{confirming && CONFIRM[confirming.action].body}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                انصراف
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" onClick={confirm} loading={busy}>
              {confirming && CONFIRM[confirming.action].button}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
