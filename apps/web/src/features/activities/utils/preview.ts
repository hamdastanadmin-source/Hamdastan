import type {
  ActivityAnswerValue,
  ActivityDefinition,
  JourneyAnswerOutcome,
  PlayerActivity,
  PlayerJourney,
  PlayerJourneyResult,
} from '@hamdastan/types';
import { pickCharacter, traitScores } from '@hamdastan/validation';

/**
 * The admin's full preview, simulated in the browser: an answer changes only
 * this page's copy of the journey — nothing is sent, nothing is paid — and a
 * finished journey's character comes from the same rule the API applies.
 */

/** A character, as a result the preview can show. */
export function previewResult(definition: ActivityDefinition, characterId: string | null): PlayerJourneyResult | null {
  const settings = definition.journey?.result;
  if (!settings?.enabled) return null;
  const character = settings.characters.find((c) => c.id === characterId) ?? settings.characters[0];
  if (!character) return null;
  return {
    character: { id: character.id, name: character.name, title: character.title, description: character.description, imageId: character.imageId },
    traits: settings.traits.map((trait) => ({ id: trait.id, title: trait.title, score: 0 })),
    card: settings.card,
    createdAt: new Date().toISOString(),
  };
}

/** What the API would answer to this answer — computed here, recorded nowhere. */
export function simulateAnswer(
  activity: PlayerActivity,
  definition: ActivityDefinition,
  journey: PlayerJourney,
  questionId: string,
  value: ActivityAnswerValue | null
): JourneyAnswerOutcome {
  const step = activity.steps.find((s) => s.questions.some((q) => q.id === questionId))!;
  const answers = { ...journey.answers, [questionId]: value };
  const rewards = journey.rewards;
  const question = rewards && value !== null ? rewards.perQuestion : 0;
  const dayCompleted = step.questions.every((q) => q.id in answers);

  const days = journey.days.map((day) => {
    if (day.id !== step.id) return day;
    return {
      ...day,
      answeredCount: step.questions.filter((q) => q.id in answers).length,
      status: dayCompleted ? ('completed' as const) : ('in_progress' as const),
      completedAt: dayCompleted ? new Date().toISOString() : null,
      xpEarned: day.xpEarned + question + (dayCompleted && rewards ? rewards.perDay : 0),
    };
  });
  const journeyCompleted = dayCompleted && days.every((day) => day.status === 'completed');
  const scores = traitScores(definition, answers);
  const character = journeyCompleted ? pickCharacter(definition.journey?.result, scores) : null;
  const result = character && previewResult(definition, character.id);

  return {
    status: 'recorded',
    xpAwarded: {
      question,
      day: dayCompleted && rewards ? rewards.perDay : 0,
      journey: journeyCompleted && rewards ? rewards.completion : 0,
    },
    dayCompleted,
    journeyCompleted,
    xpTotal: 0,
    media: {},
    journey: {
      ...journey,
      days,
      answers,
      completedDays: days.filter((day) => day.status === 'completed').length,
      completedAt: journeyCompleted ? new Date().toISOString() : null,
      result: result ? { ...result, traits: result.traits.map((trait) => ({ ...trait, score: scores.get(trait.id) ?? 0 })) } : journey.result,
    },
  };
}
