/**
 * The questionnaire's rules, written once: what an answer to a question may
 * be, and what a question saved from the panel may be.
 *
 * `PUT /me/onboarding/questionnaire/answers/:questionId` parses with
 * `questionnaireAnswerSchema(question)` for the question as it is stored, so
 * an answer the API stores is always one the scoring can read.
 */

import {
  ONBOARDING_EVENTS,
  SLIDER_MAX,
  SLIDER_MIN,
  type ChoiceQuestion,
  type Question,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { z } from 'zod';

export const questionIdSchema = z.string({ error: 'سؤال معتبر نیست' }).trim().min(1).max(40);

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

/** The request body for one answer to `question`. */
export function questionnaireAnswerSchema(question: Question) {
  return z.object({ answer: schemaFor(question) });
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

// ─── The admin panel ─────────────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `حداکثر ${toPersianDigits(max)} نویسه` })
    .nullable()
    .transform((value) => value || null);

/**
 * A question as the panel saves it. What fits the kind is checked here —
 * a slider has its two end labels and no options, a choice at least two
 * options and a cap no larger than them. What fits a *scored* question
 * (kind and codes fixed) is the API's rule, since only it knows which are.
 */
export const questionInputSchema = z
  .object({
    section: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)], { error: 'بخش را انتخاب کنید' }),
    kind: z.enum(['single', 'multi', 'ranked', 'slider'], { error: 'نوع سؤال را انتخاب کنید' }),
    title: z.string().trim().min(1, { error: 'متن سؤال را وارد کنید' }).max(300, { error: 'حداکثر ۳۰۰ نویسه' }),
    helper: optionalText(120),
    maxSelections: z.number().int().min(1, { error: 'دست‌کم ۱' }).nullable(),
    minLabel: optionalText(80),
    maxLabel: optionalText(80),
    options: z
      .array(
        z.object({
          code: z.string().max(40).optional(),
          label: z.string().trim().min(1, { error: 'متن گزینه را وارد کنید' }).max(200, { error: 'حداکثر ۲۰۰ نویسه' }),
        })
      )
      .max(20, { error: 'حداکثر ۲۰ گزینه' }),
  })
  .superRefine((question, ctx) => {
    if (question.kind === 'slider') {
      if (!question.minLabel) ctx.addIssue({ code: 'custom', path: ['minLabel'], message: 'برچسب ابتدای بازه را وارد کنید' });
      if (!question.maxLabel) ctx.addIssue({ code: 'custom', path: ['maxLabel'], message: 'برچسب انتهای بازه را وارد کنید' });
      return;
    }
    if (question.options.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'دست‌کم دو گزینه لازم است' });
    }
    if (question.maxSelections !== null && question.maxSelections > question.options.length) {
      ctx.addIssue({ code: 'custom', path: ['maxSelections'], message: 'از تعداد گزینه‌ها بیشتر است' });
    }
  })
  // What does not apply to the kind is dropped, so it is never stored.
  .transform((question) =>
    question.kind === 'slider'
      ? { ...question, options: [], maxSelections: null }
      : { ...question, minLabel: null, maxLabel: null, maxSelections: question.kind === 'single' ? null : question.maxSelections }
  );

export type QuestionInputBody = z.output<typeof questionInputSchema>;
