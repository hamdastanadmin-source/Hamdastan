import type { Question, QuestionId, SectionId } from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers, QuestionnaireState } from '@hamdastan/types';

/**
 * The questionnaire as a sequence of screens: which comes next, which came
 * before, and how far along each one is. Pure, so the order can be tested
 * without rendering anything.
 *
 * `questions` is what the API served, already in presentation order. The
 * four sections are four chapters: their questions, then a short reward
 * screen, then the next chapter. A ranked question is followed by a ranking
 * screen only when more than one option was picked — one pick has nothing
 * to rank.
 */

export type QuestionnaireStep =
  | { kind: 'intro' }
  | { kind: 'question'; questionId: QuestionId }
  | { kind: 'rank'; questionId: QuestionId }
  | { kind: 'reward'; section: SectionId }
  | { kind: 'processing' }
  | { kind: 'result' };

const SECTION_COUNT = 4;

/** Whether a ranked answer needs the ranking screen. */
const needsRanking = (answer: QuestionnaireAnswer | undefined) =>
  Boolean(answer && 'ranked' in answer && answer.ranked.length > 1);

/** Every screen between the intro and processing, in order. */
export function buildSteps(questions: readonly Question[], answers: QuestionnaireAnswers): QuestionnaireStep[] {
  const steps: QuestionnaireStep[] = [{ kind: 'intro' }];

  questions.forEach((question, index) => {
    steps.push({ kind: 'question', questionId: question.id });
    if (question.kind === 'ranked' && needsRanking(answers[question.id])) {
      steps.push({ kind: 'rank', questionId: question.id });
    }

    // A chapter ends where the next question is in a later section.
    const next = questions[index + 1];
    if (next && next.section !== question.section && question.section < SECTION_COUNT) {
      steps.push({ kind: 'reward', section: question.section });
    }
  });

  return steps;
}

export const sameStep = (a: QuestionnaireStep, b: QuestionnaireStep) =>
  a.kind === b.kind &&
  (!('questionId' in a) || a.questionId === (b as typeof a).questionId) &&
  (a.kind !== 'reward' || a.section === (b as typeof a).section);

/** The screen after `step`; `processing` after the last question. */
export function stepAfter(
  step: QuestionnaireStep,
  questions: readonly Question[],
  answers: QuestionnaireAnswers
): QuestionnaireStep {
  const steps = buildSteps(questions, answers);
  const index = steps.findIndex((candidate) => sameStep(candidate, step));
  return steps[index + 1] ?? { kind: 'processing' };
}

/** The screen before `step`, or null on the intro. */
export function stepBefore(
  step: QuestionnaireStep,
  questions: readonly Question[],
  answers: QuestionnaireAnswers
): QuestionnaireStep | null {
  const steps = buildSteps(questions, answers);
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
  const questionId = state.resumeQuestionId ?? state.questions[state.questions.length - 1].id;
  return { kind: 'question', questionId };
}

/**
 * 0–100, continuous: each section is a quarter, so the reward screens land
 * exactly on 25, 50 and 75 and the bar never says how many questions there
 * are. Inside a section, its questions share its quarter evenly.
 */
export function progressOf(step: QuestionnaireStep, questions: readonly Question[]): number {
  const quarter = 100 / SECTION_COUNT;
  switch (step.kind) {
    case 'intro':
      return 0;
    case 'question':
    case 'rank': {
      const question = questions.find(({ id }) => id === step.questionId);
      if (!question) return 0;
      const chapter = questions.filter(({ section }) => section === question.section);
      const index = chapter.indexOf(question) + (step.kind === 'rank' ? 0.5 : 0);
      return (question.section - 1 + index / chapter.length) * quarter;
    }
    case 'reward':
      return step.section * quarter;
    case 'processing':
    case 'result':
      return 100;
  }
}

/**
 * A ranking after the picks change: the motivations already ranked keep
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
