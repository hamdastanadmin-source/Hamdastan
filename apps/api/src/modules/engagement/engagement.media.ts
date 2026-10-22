import type { ActivityDefinition, ActivityStep, MediaKind } from '@hamdastan/types';
import { motionAssetIds } from '@hamdastan/validation';

/**
 * Every library file a definition refers to, with where it is and what it
 * must be. Pure: the service checks the list against the library on save,
 * and describes it to the player on read.
 *
 * A question's image, an option's and a cover's background must be images; a motion —
 * a mascot, an answer's, a day's end — may be an image or a motion.
 */

export type MediaRef = { path: string; id: string; needs: MediaKind | null };

function stepRefs(step: ActivityStep, s: number): MediaRef[] {
  const at = `definition.steps.${s}`;
  const refs: MediaRef[] = [];
  const motion = (path: string, ids: string[]) => ids.forEach((id) => refs.push({ path, id, needs: null }));

  if (step.cover?.backgroundImageId) {
    refs.push({ path: `${at}.cover.backgroundImageId`, id: step.cover.backgroundImageId, needs: 'image' });
  }
  motion(`${at}.cover.mascot`, motionAssetIds(step.cover?.mascot));
  motion(`${at}.answerMotion`, motionAssetIds(step.answerMotion));
  step.questions.forEach((question, q) => {
    if (question.imageId) refs.push({ path: `${at}.questions.${q}.imageId`, id: question.imageId, needs: 'image' });
    if ('options' in question) {
      question.options.forEach((option, o) => {
        if (option.imageId) refs.push({ path: `${at}.questions.${q}.options.${o}.imageId`, id: option.imageId, needs: 'image' });
      });
    }
    motion(`${at}.questions.${q}.motion`, motionAssetIds(question.motion));
  });
  return refs;
}

/**
 * Every file the definition names. `withResults` adds the characters' and
 * the card's — needed to check a save, not to play: the player is told only
 * of its own result's.
 */
export function mediaRefs(
  definition: ActivityDefinition,
  steps: readonly ActivityStep[] = definition.steps,
  withResults = steps === definition.steps
): MediaRef[] {
  const refs = steps.flatMap((step) => stepRefs(step, definition.steps.indexOf(step)));
  const motions = definition.journey?.motions;
  if (motions) {
    for (const key of ['answer', 'dayComplete', 'journeyComplete'] as const) {
      motionAssetIds(motions[key]).forEach((id) => refs.push({ path: `definition.journey.motions.${key}`, id, needs: null }));
    }
  }
  motionAssetIds(definition.journey?.dayEnd?.mascot).forEach((id) =>
    refs.push({ path: 'definition.journey.dayEnd.mascot', id, needs: null })
  );
  const result = definition.journey?.result;
  if (withResults && result) {
    result.characters.forEach((character, c) => {
      if (character.imageId) {
        refs.push({ path: `definition.journey.result.characters.${c}.imageId`, id: character.imageId, needs: 'image' });
      }
    });
    if (result.card.logoId) refs.push({ path: 'definition.journey.result.card.logoId', id: result.card.logoId, needs: 'image' });
  }
  return refs;
}
