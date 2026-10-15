import { describe, expect, it } from 'vitest';

import { zonedMidnight } from '@hamdastan/shared/time-zone';
import type { JourneySettings } from '@hamdastan/types';
import { activityInputSchema, journeyDayEndDefaults, journeyResultDefaults, motionOff } from '@hamdastan/validation';

import { journeyDays, nextUnlockAt, type DayProgress } from '../modules/engagement/engagement.journey';

/**
 * The journey clock as plain functions: which day of a campaign opens when,
 * in which zone, and what happens to a day nobody finished. No database —
 * every case is a fixed `now`, which is exactly what the device's clock
 * cannot change.
 */

const settings = (overrides: Partial<JourneySettings> = {}): JourneySettings => ({
  unlockMode: 'calendar_day',
  timezone: 'Asia/Tehran',
  missedDays: 'catch_up',
  requirePreviousDay: false,
  allowReview: true,
  questionsPerDay: 10,
  rewards: { perQuestion: 1, perDay: 10 },
  motions: { answer: motionOff(), dayComplete: motionOff(2500), journeyComplete: motionOff(3500) },
  dayEnd: journeyDayEndDefaults(),
  result: journeyResultDefaults(),
  ...overrides,
});

const days = Array.from({ length: 7 }, (_, i) => ({ id: `d${i + 1}` }));

/** Tehran is UTC+03:30 all year. */
const tehran = (local: string) => new Date(`${local}+03:30`);

/** A 7-day campaign starting on Saturday 10 October 2026 at 09:00 in Tehran. */
const START = tehran('2026-10-10T09:00:00');

const done = (at: string): DayProgress => ({ answeredCount: 10, completedAt: tehran(at) });

function clock(input: { settings?: Partial<JourneySettings>; progress?: Record<string, DayProgress>; now: Date }) {
  return journeyDays({
    settings: settings(input.settings),
    days,
    progress: new Map(Object.entries(input.progress ?? {})),
    campaignStart: START,
    now: input.now,
  });
}

const statuses = (states: ReturnType<typeof clock>) => states.map((state) => state.status);

describe('zonedMidnight', () => {
  it('is the zone’s own midnight, not UTC’s', () => {
    // 01:00 in Tehran on the 10th is still the 9th in UTC.
    const instant = tehran('2026-10-10T01:00:00');
    expect(zonedMidnight(instant, 'Asia/Tehran').toISOString()).toBe('2026-10-09T20:30:00.000Z');
    expect(zonedMidnight(instant, 'UTC').toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(zonedMidnight(instant, 'Asia/Tehran', 2).toISOString()).toBe('2026-10-11T20:30:00.000Z');
  });

  it('follows a daylight-saving change', () => {
    // London moves to BST on 29 March 2026: midnight on the 30th is 23:00 UTC on the 29th.
    expect(zonedMidnight(new Date('2026-03-28T12:00:00Z'), 'Europe/London', 2).toISOString()).toBe(
      '2026-03-29T23:00:00.000Z'
    );
  });
});

describe('journeyDays — calendar days of the campaign', () => {
  it('opens nothing before the campaign starts, then day 1 at the start', () => {
    expect(clock({ now: tehran('2026-10-10T08:59:00') })[0].status).toBe('locked');
    const states = clock({ now: tehran('2026-10-10T09:00:00') });
    expect(statuses(states)).toEqual(['available', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
  });

  it('opens day 2 at the next local midnight, for everyone at once', () => {
    const lateNight = clock({ progress: { d1: done('2026-10-10T23:10:00') }, now: tehran('2026-10-10T23:59:00') });
    expect(lateNight[1]).toMatchObject({ status: 'locked', lockReason: 'schedule' });
    expect(lateNight[1].unlocksAt?.toISOString()).toBe('2026-10-10T20:30:00.000Z');
    expect(nextUnlockAt(lateNight, tehran('2026-10-10T23:59:00'))?.toISOString()).toBe('2026-10-10T20:30:00.000Z');

    expect(clock({ now: tehran('2026-10-11T00:00:00') })[1].status).toBe('available');
  });

  it('counts days in the journey’s zone, whatever the person’s', () => {
    const now = new Date('2026-10-10T22:00:00Z'); // 01:30 on the 11th in Tehran, still the 10th in UTC
    expect(clock({ now })[1].status).toBe('available');
    expect(clock({ settings: { timezone: 'UTC' }, now })[1].status).toBe('locked');
  });

  it('keeps earlier days open by default: a late joiner can go back to any of them', () => {
    const states = clock({ progress: { d1: done('2026-10-10T10:00:00') }, now: tehran('2026-10-13T09:00:00') });
    expect(statuses(states)).toEqual(['completed', 'available', 'available', 'available', 'locked', 'locked', 'locked']);
  });

  it('holds a day behind the one before when the admin requires it', () => {
    const states = clock({
      settings: { requirePreviousDay: true },
      progress: { d1: done('2026-10-10T10:00:00') },
      now: tehran('2026-10-13T09:00:00'),
    });
    expect(statuses(states).slice(0, 4)).toEqual(['completed', 'available', 'locked', 'locked']);
    expect(states[2].lockReason).toBe('previous_day');
  });

  it('misses a day for good once the next one opens, under the lock rule — and does not block the rest', () => {
    const states = clock({
      settings: { missedDays: 'lock', requirePreviousDay: true },
      progress: { d1: done('2026-10-10T10:20:00'), d2: { answeredCount: 4, completedAt: null } },
      now: tehran('2026-10-12T09:00:00'),
    });
    expect(statuses(states).slice(0, 4)).toEqual(['completed', 'missed', 'available', 'locked']);
    expect(states[2].closesAt?.toISOString()).toBe('2026-10-12T20:30:00.000Z');
  });

  it('marks a day in progress once it has an answer', () => {
    const states = clock({ progress: { d1: { answeredCount: 3, completedAt: null } }, now: tehran('2026-10-10T10:05:00') });
    expect(states[0].status).toBe('in_progress');
  });
});

describe('journeyDays — 24 hours after the previous day', () => {
  it('opens a day 24 hours after the person finished the one before', () => {
    const input = { settings: { unlockMode: 'rolling_24h' as const }, progress: { d1: done('2026-10-10T18:00:00') } };
    expect(clock({ ...input, now: tehran('2026-10-11T17:59:00') })[1].status).toBe('locked');
    expect(clock({ ...input, now: tehran('2026-10-11T18:00:00') })[1].status).toBe('available');
    // Day 3 has no time until day 2 is done.
    expect(clock({ ...input, now: tehran('2026-10-15T00:00:00') })[2]).toMatchObject({ status: 'locked', unlocksAt: null });
  });
});

describe('the campaign’s end', () => {
  it('is derived from the start: midnight after the last day, in the journey’s zone', () => {
    const parsed = activityInputSchema.parse({
      type: 'journey',
      title: 'هفت روز',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: START.toISOString(),
      // Whatever the builder sends is replaced.
      endsAt: null,
      definition: {
        steps: days.map(({ id }, i) => ({
          id,
          title: `روز ${i + 1}`,
          description: '',
          questions: [{ id: `q${i}`, kind: 'text', title: 'چرا؟', required: true, multiline: false }],
        })),
        estimatedMinutes: 3,
        maxSubmissions: 1,
        anonymous: false,
        review: 'auto',
        assessment: null,
        journey: settings(),
        xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
      },
    });
    // Saturday the 10th + 7 days: the campaign ends as Friday the 16th does, at Tehran midnight.
    expect(parsed.endsAt).toBe(tehran('2026-10-17T00:00:00').toISOString());
  });

  it('refuses a journey with no start', () => {
    const result = activityInputSchema.safeParse({
      type: 'journey',
      title: 'بی‌شروع',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: {
        steps: [{ id: 'd1', title: 'روز ۱', description: '', questions: [{ id: 'q', kind: 'text', title: 'چرا؟', required: true, multiline: false }] }],
        estimatedMinutes: 3,
        maxSubmissions: 1,
        anonymous: false,
        review: 'auto',
        assessment: null,
        journey: settings(),
        xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
      },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('startsAt');
  });
});

describe('a journey day’s cover', () => {
  const input = (type: 'journey' | 'survey', cover: unknown) => ({
    type,
    title: 'کاور',
    summary: '',
    instructions: '',
    audience: { kind: 'all' },
    startsAt: START.toISOString(),
    endsAt: null,
    definition: {
      steps: [
        {
          id: 'd1',
          title: 'روز ۱',
          description: '',
          cover,
          questions: [{ id: 'q', kind: 'text', title: 'چرا؟', required: true, multiline: false }],
        },
      ],
      estimatedMinutes: 3,
      maxSubmissions: 1,
      anonymous: false,
      review: 'auto',
      assessment: null,
      journey: type === 'journey' ? settings() : null,
      xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
    },
  });
  const cover = { headline: 'آماده‌ای؟', text: '', buttonLabel: 'بزن بریم!', background: '#F4F1EA', entryEffect: 'fade' };

  it('is kept on a journey, its colour normalised', () => {
    const parsed = activityInputSchema.parse(input('journey', cover));
    expect(parsed.definition.steps[0].cover).toEqual({
      ...cover,
      background: '#f4f1ea',
      // A cover saved before the media library has neither; they default to none.
      backgroundImageId: null,
      mascot: motionOff(),
    });
  });

  it('is dropped from any other type', () => {
    expect(activityInputSchema.parse(input('survey', cover)).definition.steps[0].cover).toBeUndefined();
  });

  it('refuses a colour that is not #rrggbb, and an empty button', () => {
    const result = activityInputSchema.safeParse(input('journey', { ...cover, background: 'red', buttonLabel: ' ' }));
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['definition.steps.0.cover.background', 'definition.steps.0.cover.buttonLabel'])
    );
  });
});
