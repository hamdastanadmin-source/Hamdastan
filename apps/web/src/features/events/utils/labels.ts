import { formatNumber } from '@hamdastan/shared/format/number';
import type { EventAvailability, EventBookingStatus, EventCard, EventPhase } from '@hamdastan/types';

/** What the cards and the detail page say about an event's state and price. */

/** The one badge a card carries, when it has something to say. Neutral or semantic, never the brand. */
export function stateBadge(card: Pick<EventCard, 'phase' | 'availability'>): { label: string; variant: 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' } | null {
  const byPhase: Partial<Record<EventPhase, { label: string; variant: 'secondary' | 'success' | 'destructive' }>> = {
    cancelled: { label: 'لغو شد', variant: 'destructive' },
    ended: { label: 'برگزار شد', variant: 'secondary' },
    ongoing: { label: 'در حال برگزاری', variant: 'success' },
  };
  if (byPhase[card.phase]) return byPhase[card.phase]!;
  const byAvailability: Partial<Record<EventAvailability, { label: string; variant: 'warning' | 'outline' }>> = {
    sold_out: { label: 'تکمیل ظرفیت', variant: 'warning' },
    limited: { label: 'ظرفیت محدود', variant: 'outline' },
  };
  return byAvailability[card.availability] ?? null;
}

/** The person's own booking, on a card: a registration or a purchase, never mistaken for interest. */
export const BOOKING_BADGE: Partial<Record<EventBookingStatus, { label: string; variant: 'success' | 'warning' | 'destructive' }>> = {
  confirmed: { label: 'ثبت‌نام قطعی', variant: 'success' },
  pending: { label: 'در انتظار تأیید', variant: 'warning' },
  failed: { label: 'خرید ناموفق', variant: 'destructive' },
};

export const formatToman = (amount: number) => `${formatNumber(amount)} تومان`;

/** «از ۱۵۰٬۰۰۰ تومان», «رایگان», or nothing when no price is known. */
export function priceLabel(card: Pick<EventCard, 'startingPriceToman' | 'isFree'>): string | null {
  if (card.startingPriceToman !== null) return `از ${formatToman(card.startingPriceToman)}`;
  return card.isFree ? 'رایگان' : null;
}
