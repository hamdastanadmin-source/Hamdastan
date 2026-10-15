/**
 * A journey's result, worked out the same way everywhere: by the API when a
 * person finishes, and by the admin's preview when it simulates one. Pure.
 */

import type {
  ActivityAnswerValue,
  ActivityDefinition,
  JourneyCharacter,
  JourneyResultSettings,
} from '@hamdastan/types';

/** Each trait's total over the answers given: every picked option adds its points. */
export function traitScores(
  definition: ActivityDefinition,
  answers: Record<string, ActivityAnswerValue | null>
): Map<string, number> {
  const scores = new Map((definition.journey?.result?.traits ?? []).map((trait) => [trait.id, 0]));
  for (const question of definition.steps.flatMap((step) => step.questions)) {
    if (question.kind !== 'single' && question.kind !== 'multiple') continue;
    const value = answers[question.id];
    const picked = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    for (const option of question.options) {
      if (!picked.includes(option.id)) continue;
      for (const [traitId, points] of Object.entries(option.traits ?? {})) {
        if (scores.has(traitId)) scores.set(traitId, (scores.get(traitId) ?? 0) + points);
      }
    }
  }
  return scores;
}

/**
 * The character for these scores: the one standing for the top trait — the
 * first listed, on a tie — when that trait scored above zero; otherwise the
 * default. Null only when results are off or there is no character at all.
 */
export function pickCharacter(settings: JourneyResultSettings | undefined, scores: Map<string, number>): JourneyCharacter | null {
  if (!settings?.enabled || settings.characters.length === 0) return null;
  const fallback =
    settings.characters.find((character) => character.id === settings.defaultCharacterId) ?? settings.characters[0];

  let top: { id: string; score: number } | null = null;
  for (const trait of settings.traits) {
    const score = scores.get(trait.id) ?? 0;
    if (!top || score > top.score) top = { id: trait.id, score };
  }
  if (!top || top.score <= 0) return fallback;
  return settings.characters.find((character) => character.traitId === top.id) ?? fallback;
}
