'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { AdminXpGrant, Paginated } from '@hamdastan/types';
import {
  Badge,
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { errorMessage, formatDateTime } from '@/lib';

import { Pager } from './Pager';
import { ReasonDialog } from './ReasonDialog';

/**
 * Every reward this activity paid, from the ledger, with its transaction
 * id. «ابطال» appends a reversal with the reason — the grant itself stays on
 * record, marked revoked.
 */
export function GrantsPanel({
  data,
  loading,
  page,
  onPage,
  onRevoke,
}: {
  data: Paginated<AdminXpGrant> | null;
  loading: boolean;
  page: number;
  onPage: (page: number) => void;
  onRevoke: (transactionId: string, reason: string) => Promise<void>;
}) {
  const [revoking, setRevoking] = useState<AdminXpGrant | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {loading && !data && <Skeleton className="h-40 w-full" />}
      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">تراکنش</TableHead>
              <TableHead>کاربر</TableHead>
              <TableHead>XP</TableHead>
              <TableHead className="hidden md:table-cell">نسخه</TableHead>
              <TableHead className="hidden md:table-cell">زمان</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="text-end">
                <span className="sr-only">عملیات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  هنوز XPای داده نشده.
                </TableCell>
              </TableRow>
            )}
            {data.items.map((grant) => (
              <TableRow key={grant.transactionId}>
                <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">#{toPersianDigits(grant.transactionId)}</TableCell>
                <TableCell>
                  {grant.user.name || 'بدون نام'}
                  <span dir="ltr" className="block text-end text-xs tabular-nums text-muted-foreground">
                    {toPersianDigits(grant.user.phone)}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{toPersianDigits(grant.amount)}</TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {grant.version === null ? '—' : toPersianDigits(grant.version)}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                  {formatDateTime(grant.createdAt)}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {grant.revokedAt ? (
                    <span className="flex flex-col gap-1">
                      <Badge variant="error" className="w-fit">
                        باطل‌شده
                      </Badge>
                      <span className="text-xs text-muted-foreground">{grant.revokeReason}</span>
                    </span>
                  ) : (
                    <Badge variant="success">اعطاشده</Badge>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  {!grant.revokedAt && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setRevoking(grant)}>
                      ابطال
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {data && <Pager page={page} pageSize={data.pageSize} total={data.total} loading={loading} onPage={onPage} />}

      <ReasonDialog
        open={revoking !== null}
        title="ابطال XP"
        description={
          revoking
            ? `${toPersianDigits(revoking.amount)} XP از ${revoking.user.name || 'کاربر'} کم می‌شه. تراکنش اصلی پاک نمی‌شه؛ یک تراکنش اصلاحی با دلیلی که می‌نویسی کنارش ثبت می‌شه.`
            : ''
        }
        label="دلیل ابطال"
        confirmLabel="باطل کن"
        destructive
        required
        onCancel={() => setRevoking(null)}
        onConfirm={async (reason) => {
          if (!revoking) return;
          try {
            await onRevoke(revoking.transactionId, reason);
            toast.success('XP باطل شد');
            setRevoking(null);
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </div>
  );
}
