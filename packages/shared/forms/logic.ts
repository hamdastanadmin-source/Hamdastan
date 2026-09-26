/**
 * Conditional logic, evaluated in one place.
 *
 * Three things need the same answer to "is this question being asked?" — the
 * respondent's screen, the admin's preview, and the backend deciding whether a
 * required answer is missing. A second implementation of these rules is how the
 * three start disagreeing, so there is one, here, and all three import it.
 *
 * Self-contained by design: it takes a form-shaped object and a list of
 * answers, and returns sets and booleans. No React, no HTTP, no storage.
 */

import type { AnswerValue, FormAnswer, LogicOperator, LogicRule } from '@hamdastan/types';

/** The parts of a form these rules need. Anything with these fields will do. */
export type LogicContext = {
  questions: { id: string }[];
  conditionalLogic: LogicRule[];
};

export function answerOf(answers: FormAnswer[], questionId: string): AnswerValue {
  return answers.find((answer) => answer.questionId === questionId)?.value ?? null;
}

/** Whether an answer counts as "not given" — for required checks and `IS_EMPTY`. */
export function isEmptyAnswer(value: AnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** An answer as one readable string — for comparisons, exports and summaries. */
export function answerText(value: AnswerValue): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join('، ');
  if (typeof value === 'object') return Object.values(value).join('، ');
  return String(value);
}

export function matchesCondition(
  operator: LogicOperator,
  value: AnswerValue,
  expected: string | undefined
): boolean {
  switch (operator) {
    case 'IS_ANSWERED':
      return !isEmptyAnswer(value);
    case 'IS_EMPTY':
      return isEmptyAnswer(value);
    case 'EQUALS':
      return Array.isArray(value)
        ? value.includes(expected ?? '')
        : answerText(value) === (expected ?? '');
    case 'NOT_EQUALS':
      return Array.isArray(value)
        ? !value.includes(expected ?? '')
        : answerText(value) !== (expected ?? '');
    case 'CONTAINS':
      return answerText(value).includes(expected ?? '');
    case 'GREATER_THAN':
      return Number(value) > Number(expected);
    case 'LESS_THAN':
      return Number(value) < Number(expected);
    default:
      return false;
  }
}

/**
 * Which questions are currently being asked.
 *
 * `SHOW` is opt-in and `HIDE` is opt-out: a question that some rule targets
 * with `SHOW` starts hidden and appears when that rule's condition holds;
 * everything else is visible until a `HIDE` rule says otherwise.
 *
 * A hidden question is also an excused one — the backend skips its `required`
 * check — so a rule can never leave a respondent unable to submit.
 */
export function visibleQuestionIds(
  form: LogicContext,
  answers: FormAnswer[]
): Set<string> {
  const visible = new Set(form.questions.map((question) => question.id));

  for (const rule of form.conditionalLogic) {
    if (rule.action === 'SHOW' && rule.targetQuestionId) {
      visible.delete(rule.targetQuestionId);
    }
  }

  for (const rule of form.conditionalLogic) {
    if (!rule.targetQuestionId) continue;

    const matches = matchesCondition(
      rule.operator,
      answerOf(answers, rule.whenQuestionId),
      rule.value
    );

    if (rule.action === 'SHOW' && matches) visible.add(rule.targetQuestionId);
    if (rule.action === 'HIDE' && matches) visible.delete(rule.targetQuestionId);
  }

  return visible;
}

/**
 * Where the respondent goes after this page, if a rule says so.
 *
 * Returns the page to jump to, `'END'` when a rule ends the form early, or null
 * to carry on to the next page. Only rules whose condition already holds are
 * considered, so this is safe to call on every page change.
 */
export function nextPageOverride(
  form: LogicContext,
  answers: FormAnswer[],
  questionIdsOnPage: string[]
): string | 'END' | null {
  for (const rule of form.conditionalLogic) {
    if (rule.action !== 'JUMP_TO_PAGE' && rule.action !== 'END_FORM') continue;
    // A jump belongs to the page whose answer triggered it; a rule about a
    // question further down the form must not fire early.
    if (!questionIdsOnPage.includes(rule.whenQuestionId)) continue;

    const matches = matchesCondition(
      rule.operator,
      answerOf(answers, rule.whenQuestionId),
      rule.value
    );
    if (!matches) continue;

    if (rule.action === 'END_FORM') return 'END';
    if (rule.targetPageId) return rule.targetPageId;
  }

  return null;
}
