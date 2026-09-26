import Link from 'next/link';
import { CheckCircle2, FileText, PencilRuler } from 'lucide-react';
import type { ComponentType } from 'react';

import { toPersianDigits } from '@hamdastan/shared';
import type {
  FormSummary,
  FormTemplate,
  FormsOverview,
  FormsQuery,
  Paginated,
} from '@hamdastan/types';
import { Card, CardContent, CardHeader, CardTitle } from '@hamdastan/ui';

import { FormsTable } from './FormsTable';
import { FormsToolbar } from './FormsToolbar';

/**
 * «فرم‌ها و نظرسنجی‌ها», composed.
 *
 * A server component: the counts, the page of forms and the template list all
 * arrive already fetched, so the screen renders with real numbers on the first
 * paint. Anything that changes — creating, publishing, deleting — is a client
 * dialog followed by `router.refresh()`, so there is no second copy of the
 * list to keep in step with the backend.
 */

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span className={`flex size-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{toPersianDigits(value)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function FormsScreen({
  overview,
  page,
  templates,
  query,
}: {
  overview: FormsOverview;
  page: Paginated<FormSummary>;
  templates: FormTemplate[];
  query: FormsQuery;
}) {
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.sort && query.sort !== 'RECENT') params.set('sort', query.sort);
    if (target > 1) params.set('page', String(target));
    const search = params.toString();
    return search ? `/forms?${search}` : '/forms';
  };

  return (
    <div className="space-y-6">
      {/* Three cards, not four: the total-response count belonged to a form
          rather than to the dashboard, and each row already carries its own. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="کل فرم‌ها"
          value={overview.totalForms}
          icon={FileText}
          tone="bg-primary/10 text-primary"
        />
        <SummaryCard
          label="منتشرشده"
          value={overview.publishedForms}
          icon={CheckCircle2}
          tone="bg-success/15 text-success"
        />
        <SummaryCard
          label="پیش‌نویس"
          value={overview.draftForms}
          icon={PencilRuler}
          tone="bg-warning/15 text-warning"
        />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-base">فهرست فرم‌ها</CardTitle>
          <FormsToolbar query={query} templates={templates} />
        </CardHeader>

        <CardContent className="space-y-4">
          <FormsTable forms={page.items} />

          {lastPage > 1 && (
            <div className="flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                صفحهٔ {toPersianDigits(page.page)} از {toPersianDigits(lastPage)}
              </span>
              <div className="flex items-center gap-2">
                {page.page > 1 && (
                  <Link
                    href={href(page.page - 1)}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                  >
                    قبلی
                  </Link>
                )}
                {page.page < lastPage && (
                  <Link
                    href={href(page.page + 1)}
                    className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
                  >
                    بعدی
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
