'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminSubmission, Paginated, ReviewStatus } from '@hamdastan/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@hamdastan/ui';

import { errorMessage, formatDateTime } from '@/lib';

import { REVIEW_LABELS } from '../../utils/labels';
import { Pager } from './Pager';
import { ReasonDialog } from './ReasonDialog';

const ALL = 'all';

/**
 * The mission review queue: each submission with its answers — the proof —
 * and approve / reject. Approving is what pays the reward; rejecting lets
 * the person submit again.
 */
export function SubmissionsPanel({
  data,
  loading,
  status,
  onStatus,
  page,
  onPage,
  onReview,
}: {
  data: Paginated<AdminSubmission> | null;
  loading: boolean;
  status: ReviewStatus | undefined;
  onStatus: (status: ReviewStatus | undefined) => void;
  page: number;
  onPage: (page: number) => void;
  /** Absent when the admin may not review: the queue is then read-only. */
  onReview?: (id: string, decision: 'approve' | 'reject', note?: string) => Promise<{ xpAwarded: number }>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminSubmission | null>(null);

  const review = async (submission: AdminSubmission, decision: 'approve' | 'reject', note?: string) => {
    if (!onReview) return;
    setBusyId(submission.id);
    try {
      const { xpAwarded } = await onReview(submission.id, decision, note);
      toast.success(
        decision === 'approve'
          ? xpAwarded > 0
            ? `تأیید شد و ${toPersianDigits(xpAwarded)} XP به ${submission.user.name || 'کاربر'} داده شد`
            : 'تأیید شد'
          : 'رد شد؛ کاربر می‌تونه دوباره انجامش بده'
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Select
          value={status ?? ALL}
          onValueChange={(value) => onStatus(value === ALL ? undefined : (value as ReviewStatus))}
        >
          <SelectTrigger className="w-44" aria-label="وضعیت بررسی">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه</SelectItem>
            {(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((key) => (
              <SelectItem key={key} value={key}>
                {REVIEW_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && <p className="text-sm text-muted-foreground">{toPersianDigits(data.total)} مورد</p>}
      </div>

      {loading && !data && <Skeleton className="h-40 w-full" />}
      {data?.items.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">موردی نیست.</p>}

      {data?.items.map((submission) => (
        <Card key={submission.id} className="gap-4">
          <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0 pb-3">
            <CardTitle className="text-base">{submission.user.name || 'بدون نام'}</CardTitle>
            <span dir="ltr" className="text-sm tabular-nums text-muted-foreground">
              {toPersianDigits(submission.user.phone)}
            </span>
            <Badge variant={submission.reviewStatus === 'approved' ? 'success' : submission.reviewStatus === 'rejected' ? 'error' : 'warning'}>
              {REVIEW_LABELS[submission.reviewStatus as ReviewStatus]}
            </Badge>
            <span className="ms-auto text-xs text-muted-foreground">{formatDateTime(submission.submittedAt)}</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="flex flex-col gap-3 text-sm">
              {submission.answers.map((answer) => (
                <div key={answer.questionId} className="flex flex-col gap-1">
                  <dt className="text-muted-foreground">{answer.title}</dt>
                  <dd className="whitespace-pre-line break-words">{answer.value || '—'}</dd>
                </div>
              ))}
            </dl>
            {submission.reviewNote && (
              <p className="rounded-md bg-muted p-3 text-sm">یادداشت بررسی: {submission.reviewNote}</p>
            )}
            {submission.reviewStatus === 'pending' && onReview && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => review(submission, 'approve')}
                  loading={busyId === submission.id}
                >
                  <Check aria-hidden="true" />
                  تأیید
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === submission.id}
                  onClick={() => setRejecting(submission)}
                >
                  <X aria-hidden="true" />
                  رد
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {data && <Pager page={page} pageSize={data.pageSize} total={data.total} loading={loading} onPage={onPage} />}

      <ReasonDialog
        open={rejecting !== null}
        title="رد کردن پاسخ"
        description="کاربر XP نمی‌گیره و می‌تونه مأموریت رو دوباره انجام بده. یادداشت توی سابقه می‌مونه."
        label="یادداشت (اختیاری)"
        confirmLabel="رد کن"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={async (note) => {
          if (rejecting) await review(rejecting, 'reject', note);
          setRejecting(null);
        }}
      />
    </div>
  );
}
