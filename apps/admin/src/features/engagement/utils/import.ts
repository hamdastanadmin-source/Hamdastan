import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityDefinition, ActivityQuestion, ActivityType } from '@hamdastan/types';
import type { ImportedQuestionRow } from '@hamdastan/validation';

import { isBlankQuestion, limitsFor, newKey } from './draft';

/**
 * Adds the valid rows of an Excel import to a definition — after the
 * questions already there, never in place of them.
 *
 * A mission's rows go to the step whose title matches their «مرحله» cell,
 * or to a new step with that title; a row with none goes to the last step.
 * A journey's go to the day whose title matches, or to the day open in the
 * builder (`targetStep`) — an import never adds days.
 * A personality item's dimensions — a rating's or scale's one, a choice's
 * options' — are matched by title, or added. Pure: the
 * builder applies the result as one edit.
 */
export function mergeImported(
  definition: ActivityDefinition,
  type: ActivityType,
  rows: ImportedQuestionRow[],
  targetStep = definition.steps.length - 1
): { definition: ActivityDefinition; added: number } | { error: string } {
  const limits = limitsFor(type);
  const valid = rows.filter((row): row is ImportedQuestionRow & { question: ActivityQuestion } => row.question !== null);
  const total = definition.steps.reduce((sum, step) => sum + step.questions.length, 0) + valid.length;
  if (total > limits.questions) {
    return { error: `با افزودن این سؤال‌ها، تعداد سؤال‌ها از سقف ${toPersianDigits(limits.questions)} سؤال بیشتر می‌شود` };
  }

  const steps = definition.steps.map((step) => ({ ...step, questions: [...step.questions] }));
  const dimensions = [...(definition.assessment?.dimensions ?? [])];

  for (const { question, stepTitle, dimensions: named } of valid) {
    // The row's own dimension ids → the definition's, by title.
    const ids = new Map(
      named.map(({ id, title }) => {
        let dimension = dimensions.find((d) => d.title === title);
        if (!dimension) dimensions.push((dimension = { id, title, description: '' }));
        return [id, dimension.id];
      })
    );
    const placed: ActivityQuestion =
      ids.size === 0
        ? question
        : 'options' in question
          ? {
              ...question,
              options: question.options.map((option) => ({
                ...option,
                ...(option.dimensionScores && {
                  dimensionScores: Object.fromEntries(Object.entries(option.dimensionScores).map(([id, points]) => [ids.get(id) ?? id, points])),
                }),
              })),
            }
          : { ...question, dimensionId: question.dimensionId && ids.get(question.dimensionId) };

    let step =
      type === 'journey'
        ? (steps.find((s) => stepTitle && s.title === stepTitle) ?? steps[targetStep])
        : type === 'mission' && stepTitle
          ? steps.find((s) => s.title === stepTitle)
          : steps.at(-1);
    if (!step) {
      if (steps.length >= limits.steps) return { error: 'تعداد مرحله‌ها از سقف مجاز بیشتر می‌شود' };
      step = { id: newKey(), title: stepTitle, description: '', questions: [] };
      steps.push(step);
    }
    step.questions.push(placed);
  }

  // A new activity's untouched starter question — the only question there
  // is (on a journey, the only one on the open day), never written in — is
  // replaced by the import rather than kept beside it. Any question the
  // admin added stays, written in or not.
  const starterAt = type === 'journey' ? targetStep : definition.steps.length === 1 ? 0 : -1;
  const original = definition.steps[starterAt]?.questions;
  // A journey day is never emptied: only replaced when the import landed on it.
  const starter =
    original?.length === 1 &&
    isBlankQuestion(original[0]) &&
    (type !== 'journey' || steps[starterAt].questions.length > 1);
  const cleaned = starter
    ? steps.map((step, i) => (i === starterAt ? { ...step, questions: step.questions.slice(1) } : step))
    : steps;

  return {
    added: valid.length,
    definition: {
      ...definition,
      steps: cleaned.filter((step) => step.questions.length > 0),
      assessment: definition.assessment ? { ...definition.assessment, dimensions } : null,
    },
  };
}
