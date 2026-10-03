import { describe, expect, it } from 'vitest';

import type { AccountOverview, Mission } from '@hamdastan/types';

import { primaryMissionOf, rewardFrom } from './account-view';

const mission = (id: Mission['id'], status: Mission['status']): Mission => ({
  id,
  title: id,
  description: '',
  xpReward: id === 'personality_test' ? 50 : 20,
  status,
  ctaLabel: '',
  ctaHref: '',
  completedAt: status === 'completed' ? '2026-10-01T00:00:00.000Z' : null,
});

const overview = (missions: Mission[]) => ({ missions }) as AccountOverview;

describe('primaryMissionOf', () => {
  it('is the first open mission', () => {
    expect(
      primaryMissionOf([
        mission('personality_test', 'completed'),
        mission('avatar_created', 'available'),
        mission('profile_completed', 'available'),
      ])
    ).toBe('avatar_created');
  });

  it('is nothing once every mission is done', () => {
    expect(primaryMissionOf([mission('personality_test', 'completed')])).toBeNull();
  });
});

describe('rewardFrom', () => {
  const done = overview([mission('avatar_created', 'completed'), mission('profile_completed', 'available')]);

  it('reads a completed mission', () => {
    expect(rewardFrom('avatar_created', done)).toEqual({ missionId: 'avatar_created', xp: 20 });
  });

  it('ignores a mission that is not done, or not a mission at all', () => {
    expect(rewardFrom('profile_completed', done)).toBeNull();
    expect(rewardFrom('anything', done)).toBeNull();
    expect(rewardFrom(undefined, done)).toBeNull();
  });
});
