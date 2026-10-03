import {
  QUESTIONNAIRE_ORDER,
  QUESTIONS,
  type QuestionId,
  type SectionId,
} from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers, QuestionnaireState } from '@hamdastan/types';

/**
 * The questionnaire as a sequence of screens: which comes next, which came
 * before, and how far along each one is. Pure, so the order can be tested
 * without rendering anything.
 *
 * The four sections are four chapters: their questions, then a short reward
 * screen, then the next chapter. Q1 is followed by a ranking screen only when
 * more than one motivation was picked — one pick has nothing to rank.
 */

export type QuestionnaireStep =
  | { kind: 'intro' }
  | { kind: 'question'; questionId: QuestionId }
  | { kind: 'rank' }
  | { kind: 'reward'; section: SectionId }
  | { kind: 'processing' }
  | { kind: 'result' };

const SECTION_COUNT = 4;
const QUESTIONS_PER_SECTION = QUESTIONNAIRE_ORDER.length / SECTION_COUNT;

/** Whether Q1's answer needs the ranking screen. */
const needsRanking = (answers: QuestionnaireAnswers) => {
  const q1 = answers.Q1;
  return Boolean(q1 && 'ranked' in q1 && q1.ranked.length > 1);
};

/** Every screen between the intro and processing, in order. */
export function buildSteps(answers: QuestionnaireAnswers): QuestionnaireStep[] {
  const steps: QuestionnaireStep[] = [{ kind: 'intro' }];

  QUESTIONNAIRE_ORDER.forEach((questionId, index) => {
    steps.push({ kind: 'question', questionId });
    if (questionId === 'Q1' && needsRanking(answers)) steps.push({ kind: 'rank' });

    const isSectionEnd = (index + 1) % QUESTIONS_PER_SECTION === 0;
    const section = QUESTIONS[questionId].section;
    if (isSectionEnd && section < SECTION_COUNT) steps.push({ kind: 'reward', section });
  });

  return steps;
}

export const sameStep = (a: QuestionnaireStep, b: QuestionnaireStep) =>
  a.kind === b.kind &&
  (a.kind !== 'question' || a.questionId === (b as typeof a).questionId) &&
  (a.kind !== 'reward' || a.section === (b as typeof a).section);

/** The screen after `step`; `processing` after the last question. */
export function stepAfter(step: QuestionnaireStep, answers: QuestionnaireAnswers): QuestionnaireStep {
  const steps = buildSteps(answers);
  const index = steps.findIndex((candidate) => sameStep(candidate, step));
  return steps[index + 1] ?? { kind: 'processing' };
}

/** The screen before `step`, or null on the intro. */
export function stepBefore(step: QuestionnaireStep, answers: QuestionnaireAnswers): QuestionnaireStep | null {
  const steps = buildSteps(answers);
  const index = steps.findIndex((candidate) => sameStep(candidate, step));
  return index > 0 ? steps[index - 1] : null;
}

/**
 * Where someone lands. A finished questionnaire shows its result; one never
 * started shows the intro; one in progress resumes at the first unanswered
 * question — and one with every answer saved but not yet finished goes back
 * to the last question, one tap from done.
 */
export function initialStep(state: QuestionnaireState): QuestionnaireStep {
  if (state.completed) return { kind: 'result' };
  if (Object.keys(state.answers).length === 0) return { kind: 'intro' };
  const questionId = state.resumeQuestionId ?? QUESTIONNAIRE_ORDER[QUESTIONNAIRE_ORDER.length - 1];
  return { kind: 'question', questionId };
}

/**
 * 0–100, continuous: each section is a quarter, so the reward screens land
 * exactly on 25, 50 and 75 and the bar never says how many questions there are.
 */
export function progressOf(step: QuestionnaireStep): number {
  const quarter = 100 / SECTION_COUNT;
  switch (step.kind) {
    case 'intro':
      return 0;
    case 'question': {
      const index = QUESTIONNAIRE_ORDER.indexOf(step.questionId);
      return (index / QUESTIONS_PER_SECTION) * quarter;
    }
    case 'rank': {
      const index = QUESTIONNAIRE_ORDER.indexOf('Q1') + 0.5;
      return (index / QUESTIONS_PER_SECTION) * quarter;
    }
    case 'reward':
      return step.section * quarter;
    case 'processing':
    case 'result':
      return 100;
  }
}

/**
 * Q1's ranking after the picks change: the motivations already ranked keep
 * their order, new ones join at the end in the order they were tapped, and
 * the ones no longer picked drop out.
 */
export function mergeRanking(previous: readonly string[], selected: readonly string[]): string[] {
  const kept = previous.filter((code) => selected.includes(code));
  return [...kept, ...selected.filter((code) => !kept.includes(code))];
}

/** Moves the item at `index` one place up (`-1`) or down (`1`). */
export function moveItem<T>(list: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** The option codes an answer holds, whatever its kind. */
export function selectedCodes(answer: QuestionnaireAnswer | undefined): string[] {
  if (!answer) return [];
  if ('option' in answer) return [answer.option];
  if ('options' in answer) return answer.options;
  if ('ranked' in answer) return answer.ranked;
  return [];
}

/** How many things an answer selects, for analytics. A slider is one. */
export function selectionCount(answer: QuestionnaireAnswer): number {
  return 'value' in answer ? 1 : selectedCodes(answer).length;
}
