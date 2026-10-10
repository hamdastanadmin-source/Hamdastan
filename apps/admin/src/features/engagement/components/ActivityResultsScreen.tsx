'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleAlert, Download, Lock, Pencil } from 'lucide-react';
import { toast } from 'sonner';

import { ACTIVITY_TYPE_LABELS, INTEREST_CATEGORIES } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityStats, ActivityStatusAction } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hamdastan/ui';

import { useAdminCan } from '@/features/auth';
import { errorMessage, formatCount, formatDateTime, formatPercent } from '@/lib';

import { useActivityResults } from '../hooks/use-activity-results';
import { ACTION_LABELS, ACTIONS_FOR, CONFIRM_COPY, describeAudience, STATUS_BADGE, STATUS_LABELS } from '../utils/labels';
import { GrantsPanel } from './results/GrantsPanel';
import { HistoryPanel } from './results/HistoryPanel';
import { AssessmentSummary, QuestionStats } from './results/QuestionStats';
import { SubmissionsPanel } from './results/SubmissionsPanel';
import { StatusActionDialog } from './StatusActionDialog';

const ALL = 'all';
const TAB_TRIGGER = 'data-[state=active]:border-foreground data-[state=active]:text-foreground';

/** The eight figures, in reading order. */
const METRICS: { key: keyof ActivityStats; label: string; percent?: boolean }[] = [
  { key: 'eligible', label: 'کاربران هدف' },
  { key: 'started', label: 'شروع‌کننده' },
  { key: 'completed', label: 'تکمیل‌کننده' },
  { key: 'participationRate', label: 'نرخ تکمیل', percent: true },
  { key: 'responses', label: 'پاسخ معتبر' },
  { key: 'pendingReviews', label: 'در انتظار تأیید' },
  { key: 'xpAwarded', label: 'مجموع XP اعطاشده' },
  { key: 'xpRecipients', label: 'دریافت‌کنندگان XP' },
];

/** `type="date"` holds a local day; the filter wants the instant it starts. */
const dayStart = (value: string) => (value ? new Date(`${value}T00:00`).toISOString() : undefined);
const dayAfter = (value: string) =>
  value ? new Date(new Date(`${value}T00:00`).getTime() + 86_400_000).toISOString() : undefined;

/**
 * One activity's results: the figures, each question's answers, the
 * assessment outcome, the review queue, the XP paid and the history — with
 * a date and group filter, and the CSV export of what may be exported.
 */
export function ActivityResultsScreen({ id }: { id: string }) {
  const can = useAdminCan();
  const individual = can('results.individual');
  const seesXp = can('xp.read');
  const view = useActivityResults(id, { individual, xp: seesXp });
  const { results } = view;
  const [days, setDays] = useState({ from: '', to: '' });
  const [confirming, setConfirming] = useState<ActivityStatusAction | null>(null);
  const [exporting, setExporting] = useState(false);

  const data = results.data;
  const activity = data?.activity;

  const runStatus = async (action: ActivityStatusAction) => {
    try {
      await view.changeStatus(action);
      toast.success(`${ACTION_LABELS[action]} انجام شد`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await view.exportCsv();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setExporting(false);
    }
  };

  const setDay = (key: 'from' | 'to', value: string) => {
    const next = { ...days, [key]: value };
    setDays(next);
    view.setFilter({ ...view.filter, from: dayStart(next.from), to: dayAfter(next.to) });
  };

  if (results.error && !data) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>نتایج بارگذاری نشد</AlertTitle>
        <AlertDescription>
          <p>{results.error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={view.reload}>
            تلاش دوباره
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="-ms-2 w-fit text-muted-foreground">
          <Link href="/engagement">
            {/* rtl-ok: "back" is rightwards in an RTL layout. */}
            <ArrowRight aria-hidden="true" />
            استودیو
          </Link>
        </Button>
        {activity ? (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
                {activity.title}
                <Badge variant={STATUS_BADGE[activity.status]}>{STATUS_LABELS[activity.status]}</Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                {ACTIVITY_TYPE_LABELS[activity.type]} · نسخه‌ی {toPersianDigits(activity.version)} ·{' '}
                {describeAudience(activity.audience)} ·{' '}
                {activity.xpAmount === null ? (
                  'بدون XP'
                ) : (
                  <bdi dir="ltr">{toPersianDigits(activity.xpAmount)} XP</bdi>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                انتشار: {formatDateTime(activity.startsAt ?? activity.publishedAt)} · پایان:{' '}
                {activity.endsAt ? formatDateTime(activity.endsAt) : 'ندارد'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {activity.status !== 'archived' && can('activities.write') && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/engagement/${id}/edit`}>
                    <Pencil aria-hidden="true" />
                    ویرایش
                  </Link>
                </Button>
              )}
              {can('results.export') && (
                <Button variant="outline" size="sm" onClick={exportCsv} loading={exporting}>
                  <Download aria-hidden="true" />
                  خروجی CSV
                </Button>
              )}
              {(can('activities.publish') ? ACTIONS_FOR[activity.status] : []).map((action) => (
                <Button
                  key={action}
                  size="sm"
                  variant={action === 'publish' || action === 'resume' ? 'default' : 'outline'}
                  onClick={() => (CONFIRM_COPY[action] ? setConfirming(action) : runStatus(action))}
                >
                  {ACTION_LABELS[action]}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Skeleton className="h-16 w-full max-w-xl" />
        )}
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="from">از تاریخ</Label>
            <Input id="from" type="date" dir="ltr" className="w-44" value={days.from} onChange={(e) => setDay('from', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="to">تا تاریخ</Label>
            <Input id="to" type="date" dir="ltr" className="w-44" value={days.to} onChange={(e) => setDay('to', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="group">گروه</Label>
            <Select
              value={view.filter.categoryId ?? ALL}
              disabled={data?.anonymous}
              onValueChange={(value) => view.setFilter({ ...view.filter, categoryId: value === ALL ? undefined : value })}
            >
              <SelectTrigger id="group" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>همه‌ی گروه‌ها</SelectItem>
                {INTEREST_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {data?.anonymous && (
            <p className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
              <Lock aria-hidden="true" className="size-3.5" />
              نظرسنجی ناشناسه: فیلتر گروه، نام و شماره‌ی پاسخ‌دهنده‌ها در دسترس نیست.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {METRICS.map(({ key, label, percent }) => (
          <Card key={key}>
            <CardHeader className="gap-1 space-y-0 p-4">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {activity ? (percent ? formatPercent(activity.stats[key]) : formatCount(activity.stats[key])) : '—'}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      {data?.filtered && (
        <p className="-mt-3 text-xs text-muted-foreground">
          شاخص‌های بالا کل فعالیت رو نشون می‌دن؛ آمار سؤال‌ها با فیلتر محاسبه شده ({formatCount(data.responses)} پاسخ).
        </p>
      )}

      <Tabs defaultValue="questions">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="questions" className={TAB_TRIGGER}>
            آمار سؤال‌ها
          </TabsTrigger>
          {activity?.type === 'mission' && individual && (
            <TabsTrigger value="reviews" className={TAB_TRIGGER}>
              بررسی مأموریت‌ها
              {activity.stats.pendingReviews > 0 && (
                <Badge variant="warning" className="ms-1">
                  {toPersianDigits(activity.stats.pendingReviews)}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {seesXp && (
            <TabsTrigger value="xp" className={TAB_TRIGGER}>
              تراکنش‌های XP
            </TabsTrigger>
          )}
          <TabsTrigger value="history" className={TAB_TRIGGER}>
            تاریخچه
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4 flex flex-col gap-4">
          {!data && <Skeleton className="h-60 w-full" />}
          {data?.assessment && <AssessmentSummary stats={data.assessment} responses={data.responses} />}
          {data && <QuestionStats questions={data.questions} />}
        </TabsContent>

        <TabsContent value="reviews" className="mt-4">
          <SubmissionsPanel
            data={view.submissions.data}
            loading={view.submissions.loading}
            status={view.reviewStatus}
            onStatus={view.setReviewStatus}
            page={view.reviewPage}
            onPage={view.setReviewPage}
            onReview={can('submissions.review') ? view.review : undefined}
          />
        </TabsContent>

        <TabsContent value="xp" className="mt-4">
          <GrantsPanel
            data={view.grants.data}
            loading={view.grants.loading}
            page={view.grantPage}
            onPage={view.setGrantPage}
            onRevoke={can('xp.revoke') ? view.revoke : undefined}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="px-4 py-2 sm:px-6">
              <HistoryPanel events={view.history.data} loading={view.history.loading} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StatusActionDialog
        pending={confirming && activity ? { action: confirming, title: activity.title } : null}
        onCancel={() => setConfirming(null)}
        onConfirm={async (action) => {
          await runStatus(action);
          setConfirming(null);
        }}
      />
    </div>
  );
}
