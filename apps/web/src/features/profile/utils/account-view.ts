import { MISSION_IDS, type MissionId } from '@hamdastan/config';
import type { AccountOverview, Mission } from '@hamdastan/types';

/**
 * Small, pure readings of the overview the screens share. Nothing here
 * decides anything the API has not already decided — it only chooses how
 * to show it.
 */

/**
 * The one action on the hub that gets the primary (violet) button: the
 * first open mission, in catalog order. Every other action on the screen is
 * secondary, so the screen asks for one thing at a time.
 */
export function primaryMissionOf(missions: Mission[]): MissionId | null {
  return missions.find((mission) => mission.status !== 'completed')?.id ?? null;
}

/**
 * The reward a save just earned, from `?reward=<missionId>` on the way back
 * to the hub. Only a mission the API reports as completed counts, so the
 * parameter can replay an animation but never invent XP.
 */
export function rewardFrom(
  param: string | string[] | undefined,
  overview: AccountOverview
): { missionId: MissionId; xp: number } | null {
  if (typeof param !== 'string' || !(MISSION_IDS as readonly string[]).includes(param)) return null;
  const mission = overview.missions.find((m) => m.id === param && m.status === 'completed');
  return mission ? { missionId: mission.id, xp: mission.xpReward } : null;
}
