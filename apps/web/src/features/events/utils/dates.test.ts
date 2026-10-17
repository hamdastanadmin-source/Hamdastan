import { describe, expect, it } from 'vitest';

import { addDays, dayKeyOf, eventWhen } from './dates';

describe('event dates', () => {
  it('reads the day in Tehran, not in the browser', () => {
    // 22:00 UTC on the 10th is 01:30 on the 11th in Tehran (+03:30).
    expect(dayKeyOf(new Date('2030-03-10T22:00:00Z'))).toBe('2030-03-11');
  });

  it('steps across a month end', () => {
    expect(addDays('2030-01-31', 1)).toBe('2030-02-01');
  });

  it('writes one day with its time, several days as a range', () => {
    const oneDay = eventWhen('2026-10-17T18:00:00+03:30', '2026-10-17T21:00:00+03:30');
    expect(oneDay).toContain('ساعت');
    const severalDays = eventWhen('2026-10-17T18:00:00+03:30', '2026-10-19T21:00:00+03:30');
    expect(severalDays).toContain('تا');
  });

  it('keeps an event ending at midnight on its own day', () => {
    expect(eventWhen('2026-10-17T20:00:00+03:30', '2026-10-18T00:00:00+03:30')).toContain('ساعت');
  });
});
