'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AdminEventBooking, EventBookingReviewInput, Paginated } from '@hamdastan/types';

import { errorMessage } from '@/lib';
import { adminEventsService } from '@/services';

/** One event's bookings, a page at a time, and recording what the partner reported on one. */
export function useEventBookings(eventId: string) {
  const [page, setPage] = useState(1);
  const [reloads, setReloads] = useState(0);
  const [data, setData] = useState<Paginated<AdminEventBooking> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    adminEventsService.bookings(eventId, page).then(
      (result) => {
        if (!active) return;
        setData(result);
        setError(null);
      },
      (caught) => active && setError(errorMessage(caught))
    );
    return () => {
      active = false;
    };
  }, [eventId, page, reloads]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  const review = useCallback(
    async (bookingId: string, input: EventBookingReviewInput) => {
      await adminEventsService.reviewBooking(bookingId, input);
      reload();
    },
    [reload]
  );

  return { data, error, page, setPage, reload, review };
}
