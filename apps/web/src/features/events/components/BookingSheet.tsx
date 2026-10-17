'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import { EVENT_LIMITS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { EventDetail } from '@hamdastan/types';
import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@hamdastan/ui';

import type { EventActions } from '../hooks/use-event-actions';
import { eventWhen } from '../utils/dates';
import { formatToman } from '../utils/labels';

/**
 * Before booking: which ticket, how many, and a summary — the event, its
 * date, the ticket, the quantity and the price — then one primary action.
 * A free registration is confirmed by the API at once; a ticket on Fidibo
 * Art is bought on Fidibo's page, and this app only says it is waiting.
 */
export function BookingSheet({
  open,
  onOpenChange,
  event,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventDetail;
  actions: EventActions;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        // rtl-ok: `side` names the physical edge the sheet rises from.
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] overflow-y-auto rounded-t-3xl border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Mounted per opening, so each starts from the first ticket and one place. */}
        {open && <BookingForm event={event} actions={actions} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function BookingForm({ event, actions, onDone }: { event: EventDetail; actions: EventActions; onDone: () => void }) {
  const open = event.tickets.filter((ticket) => ticket.availability !== 'sold_out');
  const [ticketId, setTicketId] = useState<string | null>(open[0]?.id ?? null);
  const [quantity, setQuantity] = useState(1);
  const ticket = event.tickets.find((item) => item.id === ticketId) ?? null;
  const external = event.bookingMode === 'external';
  const total = external && ticket ? ticket.priceToman * quantity : 0;
  const needsTicket = event.tickets.length > 0 && !ticket;

  const confirm = async () => {
    const input = { ticketOptionId: ticket?.id ?? null, quantity };
    if (external) {
      await actions.handoff(input);
      return;
    }
    if (await actions.register(input)) onDone();
  };

  return (
    <div className="flex flex-col">
      <SheetHeader className="px-5 pt-6">
        <SheetTitle className="text-lg">{external ? 'خرید بلیت' : 'ثبت‌نام'}</SheetTitle>
        <SheetDescription>{event.title}</SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-5 px-5 py-2">
        {event.tickets.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label>نوع بلیت</Label>
            <RadioGroup value={ticketId ?? ''} onValueChange={setTicketId} className="gap-2">
              {event.tickets.map((item) => {
                const soldOut = item.availability === 'sold_out';
                return (
                  <Label
                    key={item.id}
                    htmlFor={`ticket-${item.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border border-border p-4 font-normal has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/10',
                      soldOut && 'opacity-50'
                    )}
                  >
                    <RadioGroupItem id={`ticket-${item.id}`} value={item.id} disabled={soldOut} />
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{item.title}</span>
                      {item.description && <span className="text-xs text-muted-foreground">{item.description}</span>}
                    </span>
                    <span className="text-sm font-semibold">
                      {soldOut ? 'تکمیل' : item.priceToman > 0 ? formatToman(item.priceToman) : 'رایگان'}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <Label>تعداد</Label>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setQuantity(quantity - 1)} disabled={quantity <= 1} aria-label="کمتر">
              <Minus aria-hidden="true" />
            </Button>
            <span className="w-6 text-center text-base font-semibold tabular-nums" aria-live="polite">
              {toPersianDigits(quantity)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setQuantity(quantity + 1)}
              disabled={quantity >= EVENT_LIMITS.QUANTITY_MAX}
              aria-label="بیشتر"
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </div>

        <Separator />

        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">زمان</dt>
            <dd className="text-end">{eventWhen(event.startAt, event.endAt)}</dd>
          </div>
          {ticket && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">بلیت</dt>
              <dd>
                {ticket.title} × {toPersianDigits(quantity)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 text-base font-bold">
            <dt>مبلغ</dt>
            <dd>{total > 0 ? formatToman(total) : external && !ticket ? 'در فیدیبو مشخص می‌شه' : 'رایگان'}</dd>
          </div>
        </dl>

        {external && (
          <p className="rounded-xl bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            پرداخت در سایت فیدیبو آرت انجام می‌شه. بعد از برگشت، وضعیت خریدت «در انتظار تأیید» می‌مونه تا فیدیبو تأییدش کنه.
          </p>
        )}
      </div>

      <SheetFooter className="gap-2 px-5 pb-5">
        <Button size="xl" className="w-full" disabled={needsTicket} loading={actions.booking} onClick={confirm}>
          {external ? 'ادامه در فیدیبو آرت' : 'تأیید ثبت‌نام'}
        </Button>
        <Button variant="ghost" size="touch" className="w-full text-muted-foreground" onClick={onDone}>
          انصراف
        </Button>
      </SheetFooter>
    </div>
  );
}
