import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityCard, ParticipationStatus, PlayerActivity, PlayerQuestion, PlayerStep } from '@hamdastan/types';

/** How the product writes an activity's status, time and call to action. */

export const STATUS_LABELS: Record<ParticipationStatus, string> = {
  not_started: 'جدید',
  in_progress: 'نیمه‌کاره',
  pending_review: 'در انتظار تأیید',
  completed: 'انجام شده',
  rejected: 'باید دوباره انجامش بدی',
};

/** A player's thin progress line, in foreground — progress is not the primary action. */
export const PROGRESS_LINE = 'h-0.5 bg-foreground/10 [&>[data-slot=progress-indicator]]:bg-foreground';

export const minutesLabel = (minutes: number) => `حدود ${toPersianDigits(minutes)} دقیقه`;

/** The world badge: the first world, and how many more — null when it is filed under none. */
export function worldLabel(worlds: ActivityCard['worlds']): string | null {
  const [first, ...rest] = worlds;
  if (!first) return null;
  return rest.length > 0 ? `${first.name} +${toPersianDigits(rest.length)}` : first.name;
}

/** The card's action: start, continue, or again — and none when it cannot be submitted. */
export function ctaLabel(card: ActivityCard): string | null {
  if (!card.canSubmit) return null;
  if (card.status === 'in_progress') return 'ادامه';
  if (card.status === 'completed') return 'انجام دوباره';
  if (card.status === 'rejected') return 'انجام دوباره';
  return 'شروع';
}

/** Open first, then waiting, then done — the order home and the list show them in. */
export function sortForDisplay(cards: ActivityCard[]): ActivityCard[] {
  const rank = (card: ActivityCard) => (card.canSubmit ? 0 : card.status === 'pending_review' ? 1 : 2);
  return [...cards].sort((a, b) => rank(a) - rank(b));
}

/** The player walks one question at a time; each knows the step it belongs to. */
export type FlowItem = { step: PlayerStep; stepIndex: number; question: PlayerQuestion };

export function flowOf(activity: PlayerActivity): FlowItem[] {
  return activity.steps.flatMap((step, stepIndex) => step.questions.map((question) => ({ step, stepIndex, question })));
}
