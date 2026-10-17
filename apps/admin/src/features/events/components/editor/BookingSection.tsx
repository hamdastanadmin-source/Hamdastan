'use client';

import { Plus, Trash2 } from 'lucide-react';

import {
  EVENT_BOOKING_MODE_LABELS,
  EVENT_BOOKING_MODES,
  EVENT_LIMITS,
  TICKET_AVAILABILITIES,
  TICKET_AVAILABILITY_LABELS,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { EventBookingMode, TicketAvailability } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';

import { Field, invalid } from '@/components';

import { emptyTicket, type TicketDraft } from '../../utils/draft';
import { TOGGLE_ITEM, type SectionProps } from './types';

/**
 * G. How people take part: nothing to book, a free registration in
 * Hamdastan, or tickets on Fidibo Art. A handoff to Fidibo is recorded as
 * «در انتظار تأیید» until someone confirms it from the bookings tab —
 * coming back to the app proves nothing.
 */
export function BookingSection({ editor }: SectionProps) {
  const { state, update, errors } = editor;
  const tickets = state.tickets;
  const setTicket = (index: number, patch: Partial<TicketDraft>) =>
    update({ tickets: tickets.map((ticket, i) => (i === index ? { ...ticket, ...patch } : ticket)) });
  const ticketError = (index: number, field: string) => errors[`tickets.${index}.${field}`];

  return (
    <div className="flex flex-col gap-6">
      <Field label="روش شرکت" error={errors.bookingMode}>
        <ToggleGroup
          type="single"
          value={state.bookingMode}
          onValueChange={(mode) => mode && update({ bookingMode: mode as EventBookingMode })}
          spacing={2}
          className="flex-wrap"
          aria-label="روش شرکت"
        >
          {EVENT_BOOKING_MODES.map((mode) => (
            <ToggleGroupItem key={mode} value={mode} className={TOGGLE_ITEM}>
              {EVENT_BOOKING_MODE_LABELS[mode]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {state.bookingMode === 'external' && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="نشانی خرید در فیدیبو آرت" htmlFor="booking-url" error={errors.externalBookingUrl}>
              <Input
                id="booking-url"
                dir="ltr"
                type="url"
                placeholder="https://"
                value={state.externalBookingUrl ?? ''}
                onChange={(event) => update({ externalBookingUrl: event.target.value || null })}
                {...invalid(errors.externalBookingUrl)}
              />
            </Field>
            <Field label="شناسه‌ی رویداد در فیدیبو" htmlFor="partner-ref" error={errors.partnerRef} hint="اختیاری؛ برای تطبیق رزروها.">
              <Input id="partner-ref" dir="ltr" value={state.partnerRef} onChange={(event) => update({ partnerRef: event.target.value })} {...invalid(errors.partnerRef)} />
            </Field>
          </div>
          <Alert>
            <AlertDescription>
              کاربر برای خرید به فیدیبو آرت می‌ره و رزروش «در انتظار تأیید» ثبت می‌شه. وقتی فیدیبو خرید رو تأیید کرد، از زبانه‌ی
              «رزروها» تأییدش کن.
            </AlertDescription>
          </Alert>
        </>
      )}

      {state.bookingMode === 'free_registration' && (
        <Field label="ظرفیت" htmlFor="capacity" error={errors.capacity} hint="خالی یعنی بدون محدودیت.">
          <Input
            id="capacity"
            dir="ltr"
            inputMode="numeric"
            className="sm:max-w-40"
            value={state.capacity}
            onChange={(event) => update({ capacity: event.target.value })}
            {...invalid(errors.capacity)}
          />
        </Field>
      )}

      {state.bookingMode !== 'none' && (
        <Field
          label="انواع بلیت"
          error={errors.tickets}
          hint={`اختیاری، حداکثر ${toPersianDigits(EVENT_LIMITS.TICKETS_MAX)} نوع. اگه بلیتی تعریف بشه، کاربر یکی رو انتخاب می‌کنه.`}
        >
          <ul className="flex flex-col gap-3">
            {tickets.map((ticket, index) => (
              <li key={ticket.key} className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                <Field label="عنوان" htmlFor={`${ticket.key}-title`} error={ticketError(index, 'title')}>
                  <Input
                    id={`${ticket.key}-title`}
                    placeholder="عادی، VIP، دانشجویی"
                    value={ticket.title}
                    onChange={(event) => setTicket(index, { title: event.target.value })}
                    {...invalid(ticketError(index, 'title'))}
                  />
                </Field>
                <Field label="قیمت (تومان)" htmlFor={`${ticket.key}-price`} error={ticketError(index, 'priceToman')} hint="صفر یعنی رایگان.">
                  <Input
                    id={`${ticket.key}-price`}
                    dir="ltr"
                    inputMode="numeric"
                    value={ticket.priceToman}
                    onChange={(event) => setTicket(index, { priceToman: event.target.value })}
                    {...invalid(ticketError(index, 'priceToman'))}
                  />
                </Field>
                <Field label="ظرفیت" htmlFor={`${ticket.key}-capacity`} error={ticketError(index, 'capacity')} hint="خالی یعنی بدون محدودیت.">
                  <Input
                    id={`${ticket.key}-capacity`}
                    dir="ltr"
                    inputMode="numeric"
                    value={ticket.capacity}
                    onChange={(event) => setTicket(index, { capacity: event.target.value })}
                    {...invalid(ticketError(index, 'capacity'))}
                  />
                </Field>
                <Field label="وضعیت موجودی" htmlFor={`${ticket.key}-availability`}>
                  <Select value={ticket.availability} onValueChange={(availability) => setTicket(index, { availability: availability as TicketAvailability })}>
                    <SelectTrigger id={`${ticket.key}-availability`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_AVAILABILITIES.map((availability) => (
                        <SelectItem key={availability} value={availability}>
                          {TICKET_AVAILABILITY_LABELS[availability]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="توضیح" htmlFor={`${ticket.key}-description`} error={ticketError(index, 'description')} className="sm:col-span-2">
                  <Input
                    id={`${ticket.key}-description`}
                    value={ticket.description}
                    onChange={(event) => setTicket(index, { description: event.target.value })}
                  />
                </Field>
                <Field label="مزایا" htmlFor={`${ticket.key}-benefits`} hint="هر مورد در یک خط." error={ticketError(index, 'benefits')}>
                  <Textarea
                    id={`${ticket.key}-benefits`}
                    rows={3}
                    value={ticket.benefits}
                    onChange={(event) => setTicket(index, { benefits: event.target.value })}
                  />
                </Field>
                {state.bookingMode === 'external' && (
                  <Field label="شناسه‌ی بلیت در فیدیبو" htmlFor={`${ticket.key}-external`} hint="اختیاری.">
                    <Input
                      id={`${ticket.key}-external`}
                      dir="ltr"
                      value={ticket.externalId}
                      onChange={(event) => setTicket(index, { externalId: event.target.value })}
                    />
                  </Field>
                )}
                <div className="sm:col-span-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => update({ tickets: tickets.filter((_, i) => i !== index) })}
                  >
                    <Trash2 aria-hidden="true" />
                    حذف این بلیت
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {tickets.length < EVENT_LIMITS.TICKETS_MAX && (
            <Button variant="outline" className="w-fit" onClick={() => update({ tickets: [...tickets, emptyTicket()] })}>
              <Plus aria-hidden="true" />
              افزودن نوع بلیت
            </Button>
          )}
        </Field>
      )}
    </div>
  );
}
