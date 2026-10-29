import type { ActivityDefinition, ActivityStep, MediaKind } from '@hamdastan/types';
import { motionAssetIds } from '@hamdastan/validation';

/**
 * Every library file a definition refers to, with where it is and what it
 * must be. Pure: the service checks the list against the library on save,
 * and describes it to the player on read.
 *
 * A question's image, an option's, a dimension's, a profile's, the done
 * screen's, a cover's background and a «این یا اون» card must be images; a
 * motion — a mascot, an answer's, a day's end — may be an image or a motion.
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
  // A personality or profile result shows its own image; the player has them all up front, as it does a question's.
  const assessment = definition.assessment;
  const outcomes =
    assessment?.mode === 'personality'
      ? { key: 'dimensions', list: assessment.dimensions }
      : assessment?.mode === 'profile'
        ? { key: 'profiles', list: assessment.profiles ?? [] }
        : null;
  outcomes?.list.forEach((outcome, o) => {
    const at = `definition.assessment.${outcomes.key}.${o}`;
    if (outcome.imageId) refs.push({ path: `${at}.imageId`, id: outcome.imageId, needs: 'image' });
    for (const [gender, id] of Object.entries(outcome.genderImageIds ?? {})) {
      if (id) refs.push({ path: `${at}.genderImageIds.${gender}`, id, needs: 'image' });
    }
  });
  const resultImageId = definition.resultPage?.imageId;
  if (resultImageId) refs.push({ path: 'definition.resultPage.imageId', id: resultImageId, needs: 'image' });
  // «این یا اون»: the cover and every card, all images.
  const duel = definition.thisOrThat;
  if (duel?.coverImageId) refs.push({ path: 'definition.thisOrThat.coverImageId', id: duel.coverImageId, needs: 'image' });
  duel?.cards.forEach((card, c) => {
    if (card.imageId) refs.push({ path: `definition.thisOrThat.cards.${c}.imageId`, id: card.imageId, needs: 'image' });
  });
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
