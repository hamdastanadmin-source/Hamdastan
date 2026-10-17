'use client';

import { useState } from 'react';
import { Bookmark, CircleCheck, Clock, CircleAlert } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import type { EventDetail } from '@hamdastan/types';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hamdastan/ui';

import { ScreenFooter } from '@/components';

import { useEventActions } from '../hooks/use-event-actions';
import { priceLabel } from '../utils/labels';
import { BookingSheet } from './BookingSheet';

/** Why there is no action, when there is none. */
const CLOSED: Partial<Record<EventDetail['cta']['kind'], string>> = {
  none: 'برای این رویداد ثبت‌نام لازم نیست.',
  sold_out: 'ظرفیت این رویداد تکمیل شده.',
  registration_closed: 'مهلت ثبت‌نام تموم شده.',
  ended: 'این رویداد برگزار شده.',
  cancelled: 'این رویداد لغو شده.',
};

/**
 * The bottom of an event's page: «علاقه‌مندم», and the one action the API
 * offers — register, or buy on Fidibo Art — with the person's booking above
 * it when they have one. A booking made on Fidibo reads «در انتظار تأیید»
 * until it is confirmed; nothing here takes coming back as success.
 */
export function EventBookingBar({ event }: { event: EventDetail }) {
  const actions = useEventActions();
  const { interest } = actions;
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { cta } = event;
  const mine = event.booking;
  const price = priceLabel(event);

  const status =
    mine?.status === 'pending'
      ? { icon: Clock, tone: 'text-warning', text: 'خریدت در فیدیبو آرت ثبت شده و در انتظار تأییده.' }
      : mine?.status === 'confirmed'
        ? { icon: CircleCheck, tone: 'text-success', text: mine.source === 'internal' ? 'ثبت‌نامت قطعی شده.' : 'خرید بلیتت تأیید شده.' }
        : mine?.status === 'failed'
          ? { icon: CircleAlert, tone: 'text-destructive', text: 'خرید قبلیت ناموفق بود؛ می‌تونی دوباره امتحان کنی.' }
          : null;

  const primary =
    cta.kind === 'register'
      ? 'ثبت‌نام رایگان'
      : cta.kind === 'external'
        ? mine?.status === 'pending'
          ? null
          : cta.free
            ? 'دریافت بلیت'
            : 'خرید بلیت'
        : null;

  return (
    <ScreenFooter className="flex flex-col gap-3">
      {status && (
        <p className={cn('flex items-center gap-2 text-sm font-medium', status.tone)} role="status">
          <status.icon aria-hidden="true" className="size-4 shrink-0" />
          {status.text}
        </p>
      )}
      {!primary && !status && CLOSED[cta.kind] && <p className="text-sm text-muted-foreground">{CLOSED[cta.kind]}</p>}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className={cn('size-12 shrink-0 rounded-lg', interest && 'border-primary bg-primary/10 text-primary')}
          onClick={actions.toggleInterest}
          disabled={actions.busy}
          aria-pressed={Boolean(interest)}
          aria-label={interest ? 'برداشتن از علاقه‌مندی‌ها' : 'علاقه‌مندم'}
        >
          <Bookmark aria-hidden="true" className={cn('size-5', interest && 'fill-current')} />
        </Button>

        {primary ? (
          <Button size="xl" className="flex-1" disabled={actions.busy} onClick={() => setBooking(true)}>
            {primary}
            {cta.kind === 'external' && price && !cta.free && <span className="text-sm font-normal opacity-80">{price}</span>}
          </Button>
        ) : cta.kind === 'registered' ? (
          <Button variant="outline" size="xl" className="flex-1" onClick={() => setCancelling(true)} disabled={actions.busy}>
            لغو ثبت‌نام
          </Button>
        ) : cta.kind === 'external' && mine?.status === 'pending' ? (
          <Button variant="outline" size="xl" className="flex-1" onClick={() => setBooking(true)} disabled={actions.busy}>
            دوباره رفتن به فیدیبو آرت
          </Button>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">{interest ? 'توی علاقه‌مندی‌هات هست' : 'علاقه‌مندم'}</span>
        )}
      </div>

      <BookingSheet open={booking} onOpenChange={setBooking} event={event} actions={actions} />

      <Dialog open={cancelling} onOpenChange={(open) => !actions.busy && setCancelling(open)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>لغو ثبت‌نام</DialogTitle>
            <DialogDescription>جات آزاد می‌شه و ممکنه کس دیگه‌ای بگیرتش.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={actions.busy}>
                منصرف شدم
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={actions.booking}
              onClick={async () => {
                await actions.cancelRegistration();
                setCancelling(false);
              }}
            >
              لغو ثبت‌نام
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScreenFooter>
  );
}
