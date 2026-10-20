import type {
  ActivityAnswers,
  ActivityDefinition,
  ActivityQuestion,
  ActivityType,
  AnswerReview,
  AssessmentResult,
  ChoiceQuestion,
  MatchingQuestion,
} from '@hamdastan/types';

/**
 * The assessment engine and the XP rule: pure functions of a definition and
 * a set of answers. No storage, no HTTP — the same answers always give the
 * same result, which is what lets a result be recomputed and tested.
 *
 * Knowledge: a choice question is right when the picks are exactly its
 * correct options, a matching question when every prompt has its own match;
 * the score is the share right, 0–100. A matching question scores as one.
 *
 * Personality: every answered item is put on 0–1 (a rating or scale by its
 * position on the range, a choice by its option's points relative to the
 * question's lowest and highest), turned round when the item is
 * reverse-keyed, and averaged per dimension; the dimension on top is the
 * outcome. Ties go to the dimension listed first.
 */

const isChoice = (question: ActivityQuestion): question is ChoiceQuestion =>
  question.kind === 'single' || question.kind === 'multiple';

/** The questions a knowledge quiz scores: the ones with a key. */
const isKeyed = (question: ActivityQuestion): question is ChoiceQuestion | MatchingQuestion =>
  isChoice(question) || question.kind === 'matching';

/** The key: a choice question's correct options, a matching question's match per prompt. */
const keyOf = (question: ChoiceQuestion | MatchingQuestion): string[] =>
  question.kind === 'matching'
    ? question.pairs.map((pair) => pair.matchId)
    : question.options.filter((option) => option.correct).map((option) => option.id);

const allQuestions = (definition: ActivityDefinition) =>
  definition.steps.flatMap((step) => step.questions);

function isCorrect(question: ChoiceQuestion | MatchingQuestion, value: ActivityAnswers[string] | undefined): boolean {
  const picked = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
  const correct = keyOf(question);
  if (picked.length !== correct.length) return false;
  // A match is right only against its own prompt; a choice's picks in any order.
  return question.kind === 'matching'
    ? correct.every((id, i) => picked[i] === id)
    : correct.every((id) => picked.includes(id));
}

/** One answered item on 0–1, before reverse-keying; null when it does not score. */
function itemValue(question: ActivityQuestion, value: ActivityAnswers[string] | undefined): number | null {
  if (value === undefined) return null;
  switch (question.kind) {
    case 'rating':
      return typeof value === 'number' ? (value - 1) / (question.max - 1) : null;
    case 'scale':
      return typeof value === 'number' ? (value - question.min) / (question.max - question.min) : null;
    case 'single':
    case 'multiple': {
      const scores = question.options.map((option) => option.score ?? 0);
      const low = Math.min(...scores);
      const range = Math.max(...scores) - low;
      const picked = (Array.isArray(value) ? value : [value])
        .map((id) => question.options.find((option) => option.id === id))
        .filter((option) => option !== undefined);
      if (picked.length === 0) return null;
      const mean = picked.reduce((sum, option) => sum + (option.score ?? 0), 0) / picked.length;
      return range === 0 ? 0.5 : (mean - low) / range;
    }
    case 'text':
    case 'matching':
      return null;
  }
}

export function scoreAssessment(definition: ActivityDefinition, answers: ActivityAnswers): AssessmentResult | null {
  const settings = definition.assessment;
  if (!settings) return null;
  const questions = allQuestions(definition);

  if (settings.mode === 'knowledge') {
    const scored = questions.filter(isKeyed);
    const right = scored.filter((question) => isCorrect(question, answers[question.id])).length;
    const score = scored.length ? Math.round((right / scored.length) * 100) : 0;
    return {
      mode: 'knowledge',
      score,
      passed: settings.passingScore === null ? null : score >= settings.passingScore,
      dimensions: [],
      outcome: null,
    };
  }

  const dimensions = settings.dimensions.map((dimension) => {
    const values = questions
      .filter((question) => question.dimensionId === dimension.id)
      .map((question) => {
        const value = itemValue(question, answers[question.id]);
        return value === null ? null : question.reverse ? 1 - value : value;
      })
      .filter((value) => value !== null);
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    return { dimension, value: mean === null ? null : Math.round(mean * 100) };
  });

  const measured = dimensions.filter((entry) => entry.value !== null);
  const top = measured.reduce<(typeof measured)[number] | null>(
    (best, entry) => (best === null || entry.value! > best.value! ? entry : best),
    null
  );

  return {
    mode: 'personality',
    score: null,
    passed: null,
    dimensions: measured.map(({ dimension, value }) => ({ id: dimension.id, title: dimension.title, value: value! })),
    outcome: top ? { title: top.dimension.title, description: top.dimension.description } : null,
  };
}

/**
 * Whether a completed submission earns the activity's reward. The result
 * plays no part — a personality type or a score never changes it — except
 * where an admin set a knowledge assessment to reward only a pass.
 */
export function earnsXp(definition: ActivityDefinition, result: AssessmentResult | null): boolean {
  const { xp } = definition;
  if (!xp.enabled || xp.amount <= 0) return false;
  if (xp.requirePass) return result?.passed === true;
  return true;
}

/**
 * Whether a knowledge quiz may show this person its answers: the admin
 * allowed it, and nothing the person could still submit would profit — they
 * have used every submission, or, for a competition, it has ended (so no
 * one still playing can be told).
 */
export function mayRevealAnswers(
  activity: { type: ActivityType; definition: ActivityDefinition; endsAt: Date | null },
  submissions: number,
  now: Date
): boolean {
  const settings = activity.definition.assessment;
  if (!settings?.revealAnswers || settings.mode !== 'knowledge' || submissions === 0) return false;
  if (activity.type === 'competition') return activity.endsAt !== null && activity.endsAt <= now;
  return submissions >= activity.definition.maxSubmissions;
}

/** Each scored question after the fact: the right answer, whether the person had it, and why. */
export function reviewAnswers(definition: ActivityDefinition, answers: ActivityAnswers): AnswerReview[] {
  return allQuestions(definition)
    .filter(isKeyed)
    .map((question) => ({
      questionId: question.id,
      correct: isCorrect(question, answers[question.id]),
      correctOptionIds: keyOf(question),
      explanation: question.explanation ?? '',
    }));
}
