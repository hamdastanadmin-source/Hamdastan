'use client';

import { useState } from 'react';
import { CircleAlert, Ticket } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminEventBooking, EventBookingReviewInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

import { Field } from '@/components';
import { useAdminCan } from '@/features/auth';
import { errorMessage, formatCount, formatDateTime } from '@/lib';

import { useEventBookings } from '../hooks/use-event-bookings';
import { BOOKING_SOURCE_LABELS, BOOKING_STATUS_BADGE, BOOKING_STATUS_LABELS } from '../utils/labels';

const COLUMNS = 6;

const REVIEW_LABELS: Record<EventBookingReviewInput['status'], string> = {
  confirmed: 'تأیید خرید',
  failed: 'ناموفق',
  cancelled: 'لغو',
};

/**
 * Who registered or went to Fidibo for this event. A handoff stays «در
 * انتظار تأیید» until an operator records what Fidibo reported, with its
 * reference; a confirmed booking can still be cancelled.
 */
export function BookingsPanel({ eventId }: { eventId: string }) {
  const can = useAdminCan();
  const writable = can('events.write');
  const { data, error, page, setPage, reload, review } = useEventBookings(eventId);
  const [reviewing, setReviewing] = useState<{ booking: AdminEventBooking; status: EventBookingReviewInput['status'] } | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const open = (booking: AdminEventBooking, status: EventBookingReviewInput['status']) => {
    setReference(booking.externalRef);
    setReviewing({ booking, status });
  };

  const submit = async () => {
    if (!reviewing) return;
    setBusy(true);
    try {
      await review(reviewing.booking.id, { status: reviewing.status, externalRef: reference });
      toast.success('وضعیت رزرو ثبت شد');
      setReviewing(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>رزروها بارگذاری نشد</AlertTitle>
        <AlertDescription>
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
            تلاش دوباره
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>شخص</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead className="hidden md:table-cell">روش</TableHead>
            <TableHead className="hidden sm:table-cell">بلیت</TableHead>
            <TableHead className="hidden lg:table-cell">زمان</TableHead>
            <TableHead className="text-end">
              <span className="sr-only">عملیات</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!data &&
            Array.from({ length: 3 }, (_, row) => (
              <TableRow key={row}>
                {Array.from({ length: COLUMNS }, (_, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-5 w-full max-w-24" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {data?.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Ticket aria-hidden="true" className="size-8" />
                  هنوز کسی ثبت‌نام یا خرید نکرده
                </div>
              </TableCell>
            </TableRow>
          )}
          {data?.items.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                {booking.person.name || '—'}
                <span className="block text-xs text-muted-foreground tabular-nums" dir="ltr">
                  {booking.person.phone}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={BOOKING_STATUS_BADGE[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Badge>
                {booking.externalRef && (
                  <span className="mt-1 block font-mono text-xs text-muted-foreground" dir="ltr">
                    {booking.externalRef}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden text-sm md:table-cell">{BOOKING_SOURCE_LABELS[booking.source]}</TableCell>
              <TableCell className="hidden text-sm sm:table-cell">
                {booking.ticketTitle ?? '—'} × {formatCount(booking.quantity)}
                {booking.totalToman > 0 && (
                  <span className="block text-xs text-muted-foreground">{formatCount(booking.totalToman)} تومان</span>
                )}
              </TableCell>
              <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDateTime(booking.createdAt)}</TableCell>
              <TableCell className="text-end">
                {writable && booking.status === 'pending' && (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" onClick={() => open(booking, 'confirmed')}>
                      تأیید
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => open(booking, 'failed')}>
                      ناموفق
                    </Button>
                  </div>
                )}
                {writable && booking.status === 'confirmed' && (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={() => open(booking, 'cancelled')}>
                    لغو
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {pages > 1 && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            قبلی
          </Button>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            بعدی
          </Button>
        </div>
      )}

      <Dialog open={reviewing !== null} onOpenChange={(next) => !next && !busy && setReviewing(null)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{reviewing && `${REVIEW_LABELS[reviewing.status]} — ${reviewing.booking.person.name || reviewing.booking.person.phone}`}</DialogTitle>
            <DialogDescription>
              {reviewing?.status === 'confirmed'
                ? 'فقط وقتی تأیید کن که فیدیبو خرید رو تأیید کرده باشه. شناسه‌ی خرید فیدیبو رو برای پیگیری وارد کن.'
                : 'کاربر این وضعیت رو توی «رویدادهای من» می‌بینه.'}
            </DialogDescription>
          </DialogHeader>
          <Field label="شناسه‌ی خرید در فیدیبو" htmlFor="external-ref" hint="اختیاری.">
            <Input id="external-ref" dir="ltr" value={reference} onChange={(event) => setReference(event.target.value)} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={busy}>
                انصراف
              </Button>
            </DialogClose>
            <Button type="button" variant={reviewing?.status === 'confirmed' ? 'default' : 'destructive'} onClick={submit} loading={busy}>
              {reviewing && REVIEW_LABELS[reviewing.status]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
