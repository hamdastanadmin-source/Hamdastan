import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityDefinition, ActivityQuestion, ActivityType } from '@hamdastan/types';
import type { ImportedQuestionRow } from '@hamdastan/validation';

import { newKey } from './draft';

/**
 * Adds the valid rows of an Excel import to a definition — after the
 * questions already there, never in place of them.
 *
 * A mission's rows go to the step whose title matches their «مرحله» cell,
 * or to a new step with that title; a row with none goes to the last step.
 * A personality item's dimension is matched by title, or added. Pure: the
 * builder applies the result as one edit.
 */
export function mergeImported(
  definition: ActivityDefinition,
  type: ActivityType,
  rows: ImportedQuestionRow[]
): { definition: ActivityDefinition; added: number } | { error: string } {
  const valid = rows.filter((row): row is ImportedQuestionRow & { question: ActivityQuestion } => row.question !== null);
  const total = definition.steps.reduce((sum, step) => sum + step.questions.length, 0) + valid.length;
  if (total > ENGAGEMENT_LIMITS.QUESTIONS_MAX) {
    return { error: `با این سؤال‌ها از سقف ${toPersianDigits(ENGAGEMENT_LIMITS.QUESTIONS_MAX)} سؤال رد می‌شی` };
  }

  const steps = definition.steps.map((step) => ({ ...step, questions: [...step.questions] }));
  const dimensions = [...(definition.assessment?.dimensions ?? [])];

  for (const { question, stepTitle, dimensionTitle } of valid) {
    let placed = question;
    if (dimensionTitle) {
      let dimension = dimensions.find((d) => d.title === dimensionTitle);
      if (!dimension) {
        dimension = { id: newKey(), title: dimensionTitle, description: '' };
        dimensions.push(dimension);
      }
      placed = { ...question, dimensionId: dimension.id };
    }

    let step = type === 'mission' && stepTitle ? steps.find((s) => s.title === stepTitle) : steps.at(-1);
    if (!step) {
      if (steps.length >= ENGAGEMENT_LIMITS.STEPS_MAX) return { error: 'تعداد مرحله‌ها از سقف بیشتر می‌شه' };
      step = { id: newKey(), title: stepTitle, description: '', questions: [] };
      steps.push(step);
    }
    step.questions.push(placed);
  }

  // A new activity's untouched starter question — the only question there
  // is, never written in — is replaced by the import rather than kept
  // beside it. Any question the admin added stays, written in or not.
  const starter = definition.steps.length === 1 && definition.steps[0].questions.length === 1 && isBlank(definition.steps[0].questions[0]);
  const cleaned = starter
    ? steps.map((step, i) => (i === 0 ? { ...step, questions: step.questions.slice(1) } : step))
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

/** Nothing written in it: no text, no option labels. */
function isBlank(question: ActivityQuestion): boolean {
  if (question.title.trim() !== '') return false;
  return !('options' in question) || question.options.every((option) => option.label.trim() === '');
}
