import { APP_LOCALE } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type {
  MotionSetting,
  PlayerActivity,
  PlayerJourney,
  PlayerMedia,
  PlayerQuestion,
  PlayerStep,
} from '@hamdastan/types';

/**
 * A journey's pure helpers: which motion plays, what a template says, and
 * how an opening time reads. Nothing here decides access — the API sent
 * the days' states; this only draws them.
 */

/** What actually plays: a file, a built-in effect, or nothing. */
export type Playable =
  | { kind: 'file'; media: PlayerMedia; setting: MotionSetting }
  | { kind: 'builtin'; setting: Extract<MotionSetting, { mode: 'builtin' }> }
  | { kind: 'caption'; setting: MotionSetting };

/**
 * A motion setting turned into what to play. A file the library no longer
 * has is skipped — and so is one of a random set; a random set picks with
 * `pick` (Math.random in the player, fixed in tests). Off is null.
 */
export function playableOf(
  setting: MotionSetting | undefined,
  media: Record<string, PlayerMedia>,
  pick: (count: number) => number = (count) => Math.floor(Math.random() * count)
): Playable | null {
  if (!setting || setting.mode === 'off') return null;
  if (setting.mode === 'builtin') return { kind: 'builtin', setting };
  const ids = setting.mode === 'random' ? setting.assetIds : [setting.assetId];
  const available = ids.map((id) => media[id]).filter((item): item is PlayerMedia => Boolean(item));
  if (available.length === 0) return setting.caption ? { kind: 'caption', setting } : null;
  return { kind: 'file', media: available[pick(available.length)], setting };
}

/** After an answer: the question's own motion, else its day's, else the journey's. */
export function answerMotion(question: PlayerQuestion, day: PlayerStep, journey: PlayerJourney): MotionSetting {
  return question.motion ?? day.answerMotion ?? journey.motions.answer;
}

/** `{name}`, `{day}` and `{days}` in an admin's text, filled in; a missing name leaves no gap. */
export function fillTemplate(text: string, values: { name: string | null; day: number; days: number }): string {
  return text
    .replace(/\s*\{name\}/g, values.name ? ` ${values.name}` : '')
    .replace(/\{day\}/g, toPersianDigits(values.day))
    .replace(/\{days\}/g, toPersianDigits(values.days))
    .trim();
}

const dayTime = new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', hour: '2-digit', minute: '2-digit' });

/** «فردا، ساعت ۰۰:۰۰» / «شنبه ساعت ۰۹:۰۰» — when the next day opens, as the person reads it. */
export function opensLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const hours = (at.getTime() - now.getTime()) / 3_600_000;
  const time = new Intl.DateTimeFormat(APP_LOCALE, { hour: '2-digit', minute: '2-digit' }).format(at);
  if (hours <= 0) return 'همین حالا';
  if (hours < 24 && at.getDate() === now.getDate()) return `امروز ساعت ${time}`;
  if (hours < 48 && at.getDate() === new Date(now.getTime() + 86_400_000).getDate()) return `فردا ساعت ${time}`;
  return dayTime.format(at);
}

/** «۳ ساعت و ۱۲ دقیقه» until `iso`; null once it has passed. */
export function countdownLabel(iso: string, now: Date = new Date()): string | null {
  const minutes = Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${toPersianDigits(rest)} دقیقه`;
  return rest === 0 ? `${toPersianDigits(hours)} ساعت` : `${toPersianDigits(hours)} ساعت و ${toPersianDigits(rest)} دقیقه`;
}

/** The day the person should be on: the first one open and unfinished. */
export function currentDay(activity: PlayerActivity): string | null {
  const journey = activity.journey;
  if (!journey) return null;
  return journey.days.find((day) => day.status === 'in_progress' || day.status === 'available')?.id ?? null;
}

/**
 * Where an invitation points: this journey, on this site. A newcomer signs
 * up first and is brought back here (`proxy.ts`).
 */
export function inviteUrl(activityId: string, origin: string): string {
  return `${origin}/activities/${activityId}`;
}

/** An answer as the person reads it back; a skipped question says so. */
export function answerText(question: PlayerQuestion, value: unknown): string {
  if (value === null || value === undefined) return 'بدون پاسخ';
  if (question.kind === 'single' || question.kind === 'multiple') {
    const ids = Array.isArray(value) ? value : [value];
    return question.options
      .filter((option) => ids.includes(option.id))
      .map((option) => option.label)
      .join('، ');
  }
  if (question.kind === 'matching') {
    const ids = Array.isArray(value) ? value : [];
    return question.prompts
      .map((prompt, i) => `${prompt.label} ← ${question.matches.find((match) => match.id === ids[i])?.label ?? '—'}`)
      .join('، ');
  }
  return typeof value === 'number' ? toPersianDigits(value) : String(value);
}
