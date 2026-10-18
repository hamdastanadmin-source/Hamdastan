'use client';

import { useEffect, useState } from 'react';

import type { AdminCampaign, CampaignHistoryEntry, CampaignReport } from '@hamdastan/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@hamdastan/ui';

import { formatCount, formatDateTime, formatPercent } from '@/lib';
import { adminNotificationsService } from '@/services';

import { HISTORY_LABELS } from '../utils/labels';

/**
 * What can be measured about a sent campaign, and nothing more: the
 * notifications created, how many were read and opened, and push attempts
 * by what the push service answered. «Sent» is the service's acceptance —
 * the panel never calls it delivered. Then who did what, and when.
 */
export function CampaignReportPanel({ campaign, refreshKey }: { campaign: AdminCampaign; refreshKey: number }) {
  const [report, setReport] = useState<CampaignReport | null>(null);
  const [history, setHistory] = useState<CampaignHistoryEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([adminNotificationsService.report(campaign.id), adminNotificationsService.history(campaign.id)]).then(
      ([nextReport, nextHistory]) => {
        if (!active) return;
        setReport(nextReport);
        setHistory(nextHistory);
      },
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [campaign.id, campaign.status, refreshKey]);

  const share = (part: number) => (report && report.recipients > 0 ? ` (${formatPercent(part / report.recipients)})` : '');

  const figures: [string, string][] = report
    ? [
        ['اعلان ساخته‌شده (گیرنده)', formatCount(report.recipients)],
        ['خوانده‌شده', `${formatCount(report.read)}${share(report.read)}`],
        ['باز‌شده (کلیک روی اعلان)', `${formatCount(report.opened)}${share(report.opened)}`],
        ['حذف‌شده توسط کاربر', formatCount(report.dismissed)],
        ...(campaign.push
          ? ([
              ['پوش در صف', formatCount(report.push.queued)],
              ['پوش پذیرفته‌شده توسط سرویس پوش', formatCount(report.push.sent)],
              ['پوش ناموفق', formatCount(report.push.failed)],
              ['پوش لغوشده', formatCount(report.push.cancelled)],
            ] as [string, string][])
          : []),
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">گزارش</CardTitle>
          <CardDescription>تحویلِ پوش روی دستگاه قابل اندازه‌گیری نیست؛ «پذیرفته‌شده» یعنی سرویس پوش پیام را دریافت کرده است.</CardDescription>
        </CardHeader>
        <CardContent>
          {report ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              {figures.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-bold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">تاریخچه</CardTitle>
        </CardHeader>
        <CardContent>
          {history === null ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <ol className="flex flex-col gap-3 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 last:border-0">
                  <span>
                    {HISTORY_LABELS[entry.action] ?? entry.action}
                    {entry.admin && <span className="text-muted-foreground"> — {entry.admin}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
