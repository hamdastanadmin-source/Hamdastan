import { zonedMidnight } from '@hamdastan/shared/time-zone';
import type { JourneyDayStatus, JourneySettings } from '@hamdastan/types';

/**
 * The journey clock: which of a journey's days a person may open, and when
 * the others will. A pure function of the settings, the campaign's start,
 * the person's progress and `now` — no storage, no HTTP — so the API decides
 * it on every request and the same inputs always give the same answer. The
 * device's clock never enters into it.
 *
 * Every day counts from the campaign's start, in the journey's own zone:
 * day 1 opens at the start, day n at the midnight n − 1 days after it. The
 * campaign itself ends at the midnight after its last day (the activity's
 * `endsAt`, derived by the schema), which closes every day at once.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** One day's own progress. */
export type DayProgress = { answeredCount: number; completedAt: Date | null };

export type JourneyDayState = {
  id: string;
  number: number;
  status: JourneyDayStatus;
  lockReason: 'schedule' | 'previous_day' | null;
  unlocksAt: Date | null;
  closesAt: Date | null;
};

export type JourneyClockInput = {
  settings: JourneySettings;
  days: { id: string }[];
  progress: ReadonlyMap<string, DayProgress>;
  /** The campaign's start — the activity's `startsAt`. */
  campaignStart: Date;
  now: Date;
};

/** Every day's state, in order. */
export function journeyDays({ settings, days, progress, campaignStart, now }: JourneyClockInput): JourneyDayState[] {
  const calendar = settings.unlockMode === 'calendar_day';
  const states: JourneyDayState[] = [];

  days.forEach((day, index) => {
    const own = progress.get(day.id) ?? { answeredCount: 0, completedAt: null };
    const previous = states[index - 1];

    let unlocksAt: Date | null;
    if (index === 0) unlocksAt = campaignStart;
    else if (calendar) unlocksAt = zonedMidnight(campaignStart, settings.timezone, index);
    else {
      const finished = progress.get(days[index - 1].id)?.completedAt ?? null;
      unlocksAt = finished ? new Date(finished.getTime() + DAY_MS) : null;
    }

    const closesAt =
      calendar && settings.missedDays === 'lock' ? zonedMidnight(campaignStart, settings.timezone, index + 1) : null;

    const base = { id: day.id, number: index + 1, unlocksAt, closesAt };
    const previousDone = !previous || previous.status === 'completed' || previous.status === 'missed';

    if (own.completedAt) states.push({ ...base, status: 'completed', lockReason: null });
    else if (!unlocksAt || unlocksAt > now) states.push({ ...base, status: 'locked', lockReason: 'schedule' });
    else if (closesAt && closesAt <= now) states.push({ ...base, status: 'missed', lockReason: null });
    else if (calendar && settings.requirePreviousDay && !previousDone) {
      states.push({ ...base, status: 'locked', lockReason: 'previous_day' });
    } else {
      states.push({ ...base, status: own.answeredCount > 0 ? 'in_progress' : 'available', lockReason: null });
    }
  });

  return states;
}

/** Whether a day takes answers now. */
export const isAnswerable = (state: JourneyDayState) => state.status === 'available' || state.status === 'in_progress';

/**
 * Whether anything of the day may be sent to the person: answerable, or
 * finished and open to read back. Nothing of any other day is sent.
 */
export const isReadable = (state: JourneyDayState, settings: JourneySettings) =>
  isAnswerable(state) || (state.status === 'completed' && settings.allowReview);

/** The earliest day still to open whose time is known. */
export function nextUnlockAt(states: JourneyDayState[], now: Date): Date | null {
  const upcoming = states
    .filter((state) => state.status === 'locked' && state.unlocksAt && state.unlocksAt > now)
    .map((state) => (state.unlocksAt as Date).getTime());
  return upcoming.length ? new Date(Math.min(...upcoming)) : null;
}
