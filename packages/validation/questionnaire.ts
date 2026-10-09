/**
 * The questionnaire's answer rules, written once.
 *
 * The screen in `apps/web` uses the same limits to enable its button, and
 * `PUT /me/onboarding/questionnaire/answers/:questionId` parses with
 * `questionnaireAnswerSchema`, so an answer the screen allows is an answer
 * the API accepts — and an answer the API stores is always one the scoring
 * can read.
 */

import {
  ONBOARDING_EVENTS,
  QUESTION_IDS,
  QUESTIONS,
  SLIDER_MAX,
  SLIDER_MIN,
  type ChoiceQuestion,
  type Question,
  type QuestionId,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

export const questionIdSchema = z.enum(QUESTION_IDS, { error: 'سؤال معتبر نیست' });

const INVALID_OPTION = 'یکی از گزینه‌ها معتبر نیست';
const PICK_ONE = 'یک گزینه رو انتخاب کن';

/** A list of option codes: at least one, no repeats, all on the question, within its cap. */
function codeList(question: ChoiceQuestion) {
  const codes = new Set(question.options.map(({ code }) => code));
  const max = question.maxSelections ?? question.options.length;

  return z
    .array(z.string(), { error: PICK_ONE })
    .min(1, { error: PICK_ONE })
    .max(max, { error: `حداکثر ${toPersianDigits(max)} مورد می‌تونی انتخاب کنی` })
    .refine((list) => new Set(list).size === list.length, { error: INVALID_OPTION })
    .refine((list) => list.every((code) => codes.has(code)), { error: INVALID_OPTION });
}

function schemaFor(question: Question) {
  switch (question.kind) {
    case 'single': {
      const codes = question.options.map(({ code }) => code) as [string, ...string[]];
      return z.object({ option: z.enum(codes, { error: PICK_ONE }) }).strict();
    }
    case 'multi':
      return z.object({ options: codeList(question) }).strict();
    case 'ranked':
      return z.object({ ranked: codeList(question) }).strict();
    case 'slider':
      return z
        .object({
          value: z
            .number({ error: 'یه عدد انتخاب کن' })
            .int()
            .min(SLIDER_MIN)
            .max(SLIDER_MAX),
        })
        .strict();
  }
}

const ANSWER_SCHEMAS = Object.fromEntries(
  QUESTION_IDS.map((id) => [id, schemaFor(QUESTIONS[id])])
) as Record<QuestionId, ReturnType<typeof schemaFor>>;

/** The request body for one answer to `questionId`. */
export function questionnaireAnswerSchema(questionId: QuestionId) {
  return z.object({ answer: ANSWER_SCHEMAS[questionId] });
}

/**
 * One funnel event. `presentationIndex` is not accepted: the API derives it
 * from the question id, so a client cannot misreport where a question was.
 */
export const onboardingEventSchema = z.object({
  event: z.enum(ONBOARDING_EVENTS),
  questionId: questionIdSchema.optional(),
  sectionId: z.number().int().min(1).max(4).optional(),
  properties: z
    .object({
      answerType: z.enum(['single', 'multi', 'ranked', 'slider']).optional(),
      // An hour is a bound on the request, not a product rule.
      timeSpentMs: z.number().int().min(0).max(3_600_000).optional(),
      selectionCount: z.number().int().min(0).max(20).optional(),
    })
    .strict()
    .optional(),
});

export type OnboardingEventBody = z.infer<typeof onboardingEventSchema>;
