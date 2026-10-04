import { describe, expect, it } from 'vitest';

import { badgesFor, missionsFor } from '../modules/missions';
import { levelFor, toProgress, type XpTransaction } from '../modules/progress';

const reward = (sourceType: XpTransaction['sourceType'], xp: number, id: string = sourceType): XpTransaction => ({
  id,
  sourceType,
  sourceId: sourceType,
  xp,
  createdAt: new Date('2026-10-01T10:00:00Z'),
});

describe('levelFor', () => {
  it.each([
    [0, 1, 0, 100],
    [99, 1, 0, 100],
    [100, 2, 100, 250],
    [249, 2, 100, 250],
    [250, 3, 250, 500],
    [999, 4, 500, 1000],
    [5000, 5, 1000, null],
  ])('%i XP is level %i (%i → %s)', (xp, level, levelStartXp, nextLevelXp) => {
    expect(levelFor(xp)).toEqual({ level, levelStartXp, nextLevelXp });
  });
});

describe('toProgress', () => {
  it('sums the ledger and labels each reward by what earned it', () => {
    const progress = toProgress([reward('avatar_created', 20, '2'), reward('personality_test', 50, '1')]);
    expect(progress.xpTotal).toBe(70);
    expect(progress.level).toBe(1);
    expect(progress.recent.map((r) => r.label)).toEqual(['ساخت آواتار', 'آزمون شخصیت']);
  });
});

describe('missionsFor', () => {
  it('marks exactly the missions the ledger has paid for', () => {
    const missions = missionsFor([reward('personality_test', 50)]);
    expect(missions.map((m) => [m.id, m.status])).toEqual([
      ['personality_test', 'completed'],
      ['avatar_created', 'available'],
      ['profile_completed', 'available'],
    ]);
    expect(missions[0].title).toBe('آزمون شخصیت');
    expect(missions[0].completedAt).toBe('2026-10-01T10:00:00.000Z');
  });
});

describe('badgesFor', () => {
  it('awards a badge once its missions are done, dated by the mission', () => {
    expect(badgesFor(missionsFor([]))).toEqual([]);

    const badges = badgesFor(missionsFor([reward('avatar_created', 20)]));
    expect(badges.map((b) => b.id)).toEqual(['stylist']);
    expect(badges[0].earnedAt).toBe('2026-10-01T10:00:00.000Z');
  });
});
