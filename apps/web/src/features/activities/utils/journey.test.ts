import { describe, expect, it } from 'vitest';

import type { MotionSetting, PlayerJourney, PlayerMedia, PlayerQuestion, PlayerStep } from '@hamdastan/types';

import { answerMotion, countdownLabel, fillTemplate, playableOf } from './journey';

const common = { durationMs: 1200, caption: '', sound: false };
const media = (id: string): PlayerMedia => ({ id, kind: 'motion', format: 'lottie', version: 1 });
const library = { a: media('a'), b: media('b') };

describe('playableOf', () => {
  it('plays nothing when off', () => {
    expect(playableOf({ mode: 'off', ...common }, library)).toBeNull();
  });

  it('plays the chosen file, and skips one the library no longer has', () => {
    expect(playableOf({ mode: 'custom', assetId: 'a', ...common }, library)).toMatchObject({ kind: 'file', media: { id: 'a' } });
    expect(playableOf({ mode: 'mascot', assetId: 'gone', ...common }, library)).toBeNull();
    // A caption still shows when its file is gone.
    expect(playableOf({ mode: 'custom', assetId: 'gone', ...common, caption: 'ایول!' }, library)).toMatchObject({ kind: 'caption' });
  });

  it('picks at random among the files still there', () => {
    const setting: MotionSetting = { mode: 'random', assetIds: ['a', 'gone', 'b'], ...common };
    expect(playableOf(setting, library, () => 0)).toMatchObject({ media: { id: 'a' } });
    expect(playableOf(setting, library, () => 1)).toMatchObject({ media: { id: 'b' } });
  });

  it('passes a built-in effect through', () => {
    expect(playableOf({ mode: 'builtin', effect: 'confetti', ...common }, library)).toMatchObject({ kind: 'builtin' });
  });
});

describe('answerMotion', () => {
  const journeyMotion: MotionSetting = { mode: 'builtin', effect: 'pop', ...common };
  const dayMotion: MotionSetting = { mode: 'builtin', effect: 'sparkle', ...common };
  const questionMotion: MotionSetting = { mode: 'builtin', effect: 'thumbs_up', ...common };
  const journey = { motions: { answer: journeyMotion } } as PlayerJourney;
  const question = { id: 'q', kind: 'text', title: '', required: true, multiline: false } as PlayerQuestion;
  const day = { id: 'd', title: '', description: '', questions: [] } as PlayerStep;

  it('is the question’s own, else its day’s, else the journey’s', () => {
    expect(answerMotion({ ...question, motion: questionMotion }, { ...day, answerMotion: dayMotion }, journey)).toBe(questionMotion);
    expect(answerMotion(question, { ...day, answerMotion: dayMotion }, journey)).toBe(dayMotion);
    expect(answerMotion(question, day, journey)).toBe(journeyMotion);
  });
});

describe('fillTemplate', () => {
  it('fills the name, the day and the days', () => {
    expect(fillTemplate('عالی بود {name}! روز {day} از {days}', { name: 'سارا', day: 2, days: 7 })).toBe('عالی بود سارا! روز ۲ از ۷');
  });

  it('leaves no gap for a missing name', () => {
    expect(fillTemplate('عالی بود {name}!', { name: null, day: 1, days: 7 })).toBe('عالی بود!');
  });
});

describe('countdownLabel', () => {
  const now = new Date('2026-10-14T10:00:00Z');
  it('reads hours and minutes, and nothing once passed', () => {
    expect(countdownLabel('2026-10-14T13:12:00Z', now)).toBe('۳ ساعت و ۱۲ دقیقه');
    expect(countdownLabel('2026-10-14T10:20:00Z', now)).toBe('۲۰ دقیقه');
    expect(countdownLabel('2026-10-14T09:00:00Z', now)).toBeNull();
  });
});
