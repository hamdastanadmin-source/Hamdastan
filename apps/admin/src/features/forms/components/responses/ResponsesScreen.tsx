'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Percent,
  Printer,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

import { API_BASE_URL, API_PREFIX } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared';
import type { Form, FormResponse, FormStats, Paginated } from '@hamdastan/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@hamdastan/ui';

import { useHasPermission } from '@/features/auth';

import { IndividualResponses } from './IndividualResponses';
import { QuestionAnalysis } from './QuestionAnalysis';

/**
 * What the answers add up to.
 *
 * Three tabs: the shape of the whole set, the answers one at a time, and each
 * question on its own. Every number here was computed by `apps/api` over every
 * response — the browser only ever holds one page of them, so counting here
 * would count a page and call it a total.
 */

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ResponsesScreen({
  form,
  stats,
  responses,
}: {
  form: Form;
  stats: FormStats;
  responses: Paginated<FormResponse>;
}) {
  const canExport = useHasPermission('forms.responses.export');

  /**
   * The download goes straight to the API.
   *
   * It is a file, not JSON, so the browser fetches it itself and the session
   * cookie rides along — no client code touches the bytes.
   */
  const exportHref = (format: 'CSV' | 'EXCEL') =>
    `${API_BASE_URL}${API_PREFIX}/admin/forms/${form.id}/responses/export?format=${format}`;

  const minutes = Math.floor(stats.averageCompletionSeconds / 60);
  const seconds = stats.averageCompletionSeconds % 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon-sm" asChild aria-label="بازگشت">
            <Link href="/forms">
              {/* rtl-ok: in RTL, "back" points to the right. */}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-lg font-bold">{form.title}</h2>
            {/* A div, not a p: `Badge` renders a block element, and a block
                inside a paragraph is invalid HTML — which React reports as a
                hydration mismatch rather than as the markup bug it is. */}
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              پاسخ‌های ثبت‌شده
              {form.status === 'PUBLISHED' && <Badge variant="success">منتشرشده</Badge>}
            </div>
          </div>
        </div>

        {canExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={stats.totalResponses === 0}>
                <Download className="size-4" />
                خروجی گرفتن
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={exportHref('EXCEL')} download>
                  <FileSpreadsheet className="size-4 me-2" />
                  اکسل
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={exportHref('CSV')} download>
                  <FileText className="size-4 me-2" />
                  CSV
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.print()}>
                <Printer className="size-4 me-2" />
                چاپ / PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="کل پاسخ‌ها"
          value={toPersianDigits(stats.totalResponses)}
          icon={Users}
          tone="bg-primary/10 text-primary"
        />
        <StatCard
          label="پاسخ کامل"
          value={toPersianDigits(stats.completedResponses)}
          icon={FileText}
          tone="bg-success/15 text-success"
        />
        <StatCard
          label="نرخ تکمیل"
          value={`${toPersianDigits(stats.completionRate)}٪`}
          icon={Percent}
          tone="bg-info/15 text-info"
        />
        <StatCard
          label="میانگین زمان"
          value={
            stats.averageCompletionSeconds === 0
              ? '—'
              : minutes > 0
                ? `${toPersianDigits(minutes)}:${toPersianDigits(String(seconds).padStart(2, '0'))}`
                : `${toPersianDigits(seconds)} ثانیه`
          }
          icon={Clock}
          tone="bg-warning/15 text-warning"
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="individual">پاسخ‌های تکی</TabsTrigger>
          <TabsTrigger value="questions">تحلیل پرسش‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">روند پاسخ‌ها در ۱۴ روز گذشته</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TrendChart trend={stats.trend} />

              <div className="grid gap-3 sm:grid-cols-3">
                <Tally label="کل" value={stats.totalResponses} />
                <Tally label="کامل" value={stats.completedResponses} tone="text-success" />
                <Tally label="ناقص" value={stats.incompleteResponses} tone="text-warning" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="individual" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <IndividualResponses form={form} responses={responses.items} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="pt-4">
          <QuestionAnalysis questions={stats.questions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Tally({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone}`}>{toPersianDigits(value)}</p>
    </div>
  );
}

/**
 * Responses per day, as columns.
 *
 * Heights are a share of the busiest day, so the shape is readable whether the
 * peak is three responses or three hundred.
 */
function TrendChart({ trend }: { trend: FormStats['trend'] }) {
  const peak = Math.max(...trend.map((point) => point.count), 1);

  return (
    <div className="flex h-36 items-end justify-between gap-1">
      {trend.map((point) => (
        <div key={point.date} className="group flex flex-1 flex-col items-center gap-1">
          <span className="text-2xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {toPersianDigits(point.count)}
          </span>
          <div
            className="w-full rounded-t bg-primary/70 transition-all group-hover:bg-primary"
            // A height that is data rather than a design value.
            style={{ height: `${Math.max((point.count / peak) * 100, 2)}%` }}
            title={`${point.date}: ${point.count}`}
          />
          <span className="text-2xs text-muted-foreground">
            {toPersianDigits(Number(point.date.slice(8, 10)))}
          </span>
        </div>
      ))}
    </div>
  );
}
