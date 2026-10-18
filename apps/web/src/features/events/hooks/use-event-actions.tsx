'use client';

import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { EventBookingInput, EventDetail } from '@hamdastan/types';

import { eventsService, HttpError } from '@/services';

const failure = (error: unknown) =>
  error instanceof HttpError ? error.message : 'ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.';

type Pending = 'interest' | 'booking' | null;
type Interest = EventDetail['interest'];

/**
 * What a person can do on an event's page: mark interest and its reminder,
 * register, cancel a registration, or go to Fidibo Art to buy. Every answer
 * is the API's; after each, the page is read again so what it shows — the
 * booking's state, the action on offer — is the server's, not a guess.
 *
 * Interest and the reminder show the change at once and step back if the
 * API refuses it; the page's re-read then replaces them with the server's.
 * Going to Fidibo leaves this tab for the partner's page; the booking the
 * API recorded stays «در انتظار تأیید» whatever happens there.
 */
function useEventActionsState(event: EventDetail) {
  const router = useRouter();
  // Which action is on its way, so only its own control shows it.
  const [pending, setPending] = useState<Pending>(null);
  const [refreshing, startRefresh] = useTransition();
  // The interest as last changed here, until the server's copy of the page says otherwise.
  const [shown, setShown] = useState<{ from: Interest; value: Interest } | null>(null);
  const interest = shown && shown.from === event.interest ? shown.value : event.interest;
  const refresh = () => startRefresh(() => router.refresh());

  const run = async <T,>(kind: Exclude<Pending, null>, work: () => Promise<T>, success?: string): Promise<T | null> => {
    setPending(kind);
    try {
      const result = await work();
      if (success) toast.success(success);
      refresh();
      return result;
    } catch (error) {
      toast.error(failure(error));
      refresh();
      return null;
    } finally {
      setPending(null);
    }
  };

  /** Shows `next` now; steps back to what the page had if the API refuses it. */
  const changeInterest = async (next: Interest, work: () => Promise<unknown>, success: string) => {
    setShown({ from: event.interest, value: next });
    if ((await run('interest', work, success)) === null) setShown(null);
  };

  return {
    interest,
    /** Anything on its way, the page's re-read included: controls are disabled meanwhile. */
    busy: pending !== null || refreshing,
    /** A registration, cancellation or handoff on its way. */
    booking: pending === 'booking',

    toggleInterest: () =>
      interest
        ? changeInterest(null, () => eventsService.removeInterest(event.id), 'از علاقه‌مندی‌ها برداشته شد')
        : changeInterest({ remindInApp: true }, () => eventsService.setInterest(event.id, true), 'به علاقه‌مندی‌ها اضافه شد'),

    setReminder: (remindInApp: boolean) =>
      changeInterest({ remindInApp }, () => eventsService.setInterest(event.id, remindInApp), remindInApp ? 'یادآوری روشن شد' : 'یادآوری خاموش شد'),

    register: (input: EventBookingInput) => run('booking', () => eventsService.register(event.id, input), 'ثبت‌نامت قطعی شد'),

    cancelRegistration: () => run('booking', () => eventsService.cancelRegistration(event.id), 'ثبت‌نامت لغو شد'),

    /** Records the pending booking, then opens the partner's page in this tab — back returns here. */
    handoff: async (input: EventBookingInput) => {
      setPending('booking');
      try {
        const { url } = await eventsService.handoff(event.id, input);
        window.location.assign(url);
      } catch (error) {
        toast.error(failure(error));
        setPending(null);
        refresh();
      }
    },
  };
}

export type EventActions = ReturnType<typeof useEventActionsState>;

const EventActionsContext = createContext<EventActions | null>(null);

/** One set of actions for the whole page, so the bar and the reminder card agree at every moment. */
export function EventActionsProvider({ event, children }: { event: EventDetail; children: ReactNode }) {
  return <EventActionsContext.Provider value={useEventActionsState(event)}>{children}</EventActionsContext.Provider>;
}

export function useEventActions(): EventActions {
  const actions = useContext(EventActionsContext);
  if (!actions) throw new Error('useEventActions needs an EventActionsProvider');
  return actions;
}
