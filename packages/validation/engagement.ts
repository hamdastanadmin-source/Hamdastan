/**
 * Engagement Studio's rules, written once.
 *
 * The activity builder in `apps/admin` and the `engagement` module in
 * `apps/api` parse an activity with `activityInputSchema`; the player in
 * `apps/web` and the API's submit both check answers with `validateAnswers`.
 * So a question the builder accepts is one the API stores, and an answer the
 * player lets through is one the API accepts — with the same message.
 */

import {
  ACTIVITY_TYPES,
  ENGAGEMENT_LIMITS as L,
  ENGAGEMENT_PAGE_SIZE,
  INTEREST_CATEGORIES,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type {
  ActivityAnswers,
  ActivityAnswerValue,
  ActivityDefinition,
  ActivityType,
  PlayerQuestion,
} from '@hamdastan/types';

import { z } from 'zod';

import { phoneSchema } from './auth';

const fa = (n: number) => toPersianDigits(n);

// ─── Text ────────────────────────────────────────────────────────────────────

/**
 * Free text as an admin types it: Arabic ي/ك become Persian, and the ends
 * are trimmed. Digits are left as typed — this is copy, not a value to
 * compare. A single line also has its runs of whitespace collapsed.
 */
function cleanText(value: string, multiline: boolean): string {
  const letters = value.replace(/ي/g, 'ی').replace(/ك/g, 'ک');
  return (multiline ? letters.replace(/\r\n/g, '\n') : letters.replace(/\s+/g, ' ')).trim();
}

const line = (max: number, required: string | null) =>
  z
    .string()
    .transform((value) => cleanText(value, false))
    .refine((value) => (required ? value.length > 0 : true), { error: required ?? '' })
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` });

const paragraph = (max: number) =>
  z
    .string()
    .transform((value) => cleanText(value, true))
    .refine((value) => value.length <= max, { error: `حداکثر ${fa(max)} کاراکتر` });

/** Ids are minted by the builder; the API only checks they are tame. */
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, { error: 'شناسه معتبر نیست' });

// ─── Definition ──────────────────────────────────────────────────────────────

const optionSchema = z.object({
  id: keySchema,
  label: line(L.OPTION_LABEL_MAX, 'متن گزینه رو بنویس'),
  correct: z.boolean().optional(),
  score: z.number().int().min(-10).max(10).optional(),
});

const questionBase = {
  id: keySchema,
  title: line(L.DESCRIPTION_MAX, 'متن سؤال رو بنویس'),
  description: paragraph(L.DESCRIPTION_MAX).optional(),
  required: z.boolean(),
  dimensionId: keySchema.optional(),
  reverse: z.boolean().optional(),
};

const choiceFields = {
  ...questionBase,
  options: z
    .array(optionSchema)
    .min(L.OPTIONS_MIN, { error: `حداقل ${fa(L.OPTIONS_MIN)} گزینه لازمه` })
    .max(L.OPTIONS_MAX, { error: `حداکثر ${fa(L.OPTIONS_MAX)} گزینه` }),
};

/** One question, as the builder, the Excel import and the API all check it. */
export const activityQuestionSchema = z.discriminatedUnion('kind', [
  z.object({ ...choiceFields, kind: z.literal('single') }),
  z.object({
    ...choiceFields,
    kind: z.literal('multiple'),
    maxSelections: z.number().int().min(1).optional(),
  }),
  z.object({ ...questionBase, kind: z.literal('text'), multiline: z.boolean() }),
  z.object({ ...questionBase, kind: z.literal('rating'), max: z.union([z.literal(5), z.literal(10)]) }),
  z.object({
    ...questionBase,
    kind: z.literal('scale'),
    min: z.number().int().min(L.SCALE_MIN_BOUND).max(L.SCALE_MAX_BOUND),
    max: z.number().int().min(L.SCALE_MIN_BOUND).max(L.SCALE_MAX_BOUND),
    minLabel: line(60, null),
    maxLabel: line(60, null),
  }),
]);

const stepSchema = z.object({
  id: keySchema,
  title: line(L.TITLE_MAX, null),
  description: paragraph(L.DESCRIPTION_MAX).default(''),
  questions: z.array(activityQuestionSchema).min(1, { error: 'حداقل یک سؤال لازمه' }),
});

const xpSchema = z.object({
  enabled: z.boolean(),
  amount: z
    .number({ error: 'مقدار XP رو وارد کن' })
    .int({ error: 'XP باید عدد صحیح باشه' })
    .min(0, { error: 'XP نمی‌تونه منفی باشه' })
    .max(L.XP_MAX, { error: `حداکثر ${fa(L.XP_MAX)} XP` }),
  showBeforeStart: z.boolean(),
  maxAwards: z.number().int().min(1).max(L.REPEAT_MAX),
  requirePass: z.boolean(),
});

const assessmentSchema = z.object({
  mode: z.enum(['personality', 'knowledge']),
  dimensions: z
    .array(
      z.object({
        id: keySchema,
        title: line(L.TITLE_MAX, 'عنوان بُعد رو بنویس'),
        description: paragraph(L.DESCRIPTION_MAX).default(''),
      })
    )
    .max(L.DIMENSIONS_MAX),
  passingScore: z.number().int().min(0).max(100).nullable(),
  showResult: z.boolean(),
});

const definitionSchema = z.object({
  steps: z
    .array(stepSchema)
    .min(1, { error: 'حداقل یک مرحله لازمه' })
    .max(L.STEPS_MAX, { error: `حداکثر ${fa(L.STEPS_MAX)} مرحله` }),
  estimatedMinutes: z.number().int().min(1).max(L.ESTIMATED_MINUTES_MAX),
  maxSubmissions: z.number().int().min(1).max(L.REPEAT_MAX),
  anonymous: z.boolean(),
  review: z.enum(['auto', 'manual']),
  assessment: assessmentSchema.nullable(),
  xp: xpSchema,
});

/**
 * Clears what does not belong to the type, so a builder that switched type
 * half-way cannot leave a survey with a reviewer or a mission anonymous.
 */
function forType(type: ActivityType, definition: ActivityDefinition): ActivityDefinition {
  const knowledgePassMark =
    type === 'assessment' &&
    definition.assessment?.mode === 'knowledge' &&
    definition.assessment.passingScore !== null;

  return {
    ...definition,
    steps: type === 'mission' ? definition.steps : definition.steps.slice(0, 1),
    anonymous: type === 'survey' && definition.anonymous,
    review: type === 'mission' ? definition.review : 'auto',
    assessment: type === 'assessment' ? definition.assessment : null,
    xp: {
      ...definition.xp,
      maxAwards: Math.min(definition.xp.maxAwards, definition.maxSubmissions),
      requirePass: knowledgePassMark && definition.xp.requirePass,
    },
  };
}

/** The rules that need the whole activity in view. Paths point at the field to fix. */
function checkDefinition(type: ActivityType, definition: ActivityDefinition, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path: ['definition', ...path], message });

  const questions = definition.steps.flatMap((step) => step.questions);
  if (questions.length > L.QUESTIONS_MAX) issue(['steps'], `حداکثر ${fa(L.QUESTIONS_MAX)} سؤال`);

  const ids = new Set<string>();
  definition.steps.forEach((step, s) => {
    if (type === 'mission' && !step.title) issue(['steps', s, 'title'], 'عنوان مرحله رو بنویس');

    step.questions.forEach((question, q) => {
      const at = ['steps', s, 'questions', q];
      if (ids.has(question.id)) issue([...at, 'id'], 'شناسه سؤال تکراریه');
      ids.add(question.id);

      if (question.kind === 'single' || question.kind === 'multiple') {
        const optionIds = new Set(question.options.map((option) => option.id));
        if (optionIds.size !== question.options.length) issue([...at, 'options'], 'شناسه گزینه تکراریه');
        if (question.kind === 'multiple' && (question.maxSelections ?? 0) > question.options.length) {
          issue([...at, 'maxSelections'], 'سقف انتخاب از تعداد گزینه‌ها بیشتره');
        }
      }
      if (question.kind === 'scale' && question.min >= question.max) {
        issue([...at, 'max'], 'انتهای طیف باید از ابتداش بزرگ‌تر باشه');
      }
    });
  });

  if (type !== 'assessment') return;
  const assessment = definition.assessment;
  if (!assessment) {
    issue(['assessment'], 'نوع آزمون رو انتخاب کن');
    return;
  }

  if (assessment.mode === 'personality') {
    if (assessment.dimensions.length === 0) issue(['assessment', 'dimensions'], 'حداقل یک بُعد لازمه');
    const dimensionIds = new Set(assessment.dimensions.map((dimension) => dimension.id));
    definition.steps.forEach((step, s) =>
      step.questions.forEach((question, q) => {
        if (question.kind === 'text') return;
        if (!question.dimensionId || !dimensionIds.has(question.dimensionId)) {
          issue(['steps', s, 'questions', q, 'dimensionId'], 'بُعدی که این سؤال می‌سنجه رو انتخاب کن');
        }
      })
    );
    return;
  }

  // Knowledge: every choice question needs its key; a single choice exactly one.
  definition.steps.forEach((step, s) =>
    step.questions.forEach((question, q) => {
      if (question.kind !== 'single' && question.kind !== 'multiple') return;
      const correct = question.options.filter((option) => option.correct).length;
      if (correct === 0 || (question.kind === 'single' && correct !== 1)) {
        issue(
          ['steps', s, 'questions', q, 'options'],
          question.kind === 'single' ? 'یک گزینه‌ی درست مشخص کن' : 'حداقل یک گزینه‌ی درست مشخص کن'
        );
      }
    })
  );
  if (!questions.some((question) => question.kind === 'single' || question.kind === 'multiple')) {
    issue(['steps'], 'آزمون دانشی حداقل یک سؤال گزینه‌ای لازم داره');
  }
}

// ─── Audience ────────────────────────────────────────────────────────────────

const CATEGORY_IDS = INTEREST_CATEGORIES.map((category) => category.id) as [string, ...string[]];

export const activityAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('users'),
    phones: z
      .array(phoneSchema)
      .min(1, { error: 'حداقل یک شماره وارد کن' })
      .max(L.AUDIENCE_PHONES_MAX, { error: `حداکثر ${fa(L.AUDIENCE_PHONES_MAX)} شماره` })
      .transform((phones) => [...new Set(phones)]),
  }),
  z.object({
    kind: z.literal('interests'),
    categoryIds: z
      .array(z.enum(CATEGORY_IDS))
      .min(1, { error: 'حداقل یک گروه انتخاب کن' })
      .transform((ids) => [...new Set(ids)]),
  }),
]);

// ─── Activity ────────────────────────────────────────────────────────────────

const dateTimeSchema = z.iso.datetime({ offset: true, error: 'تاریخ معتبر نیست' }).nullable();

/** `POST /admin/engagement/activities` and `PUT …/:id`. */
export const activityInputSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES, { error: 'نوع فعالیت رو انتخاب کن' }),
    title: line(L.TITLE_MAX, 'عنوان رو بنویس'),
    summary: line(L.SUMMARY_MAX, null),
    instructions: paragraph(L.DESCRIPTION_MAX),
    definition: definitionSchema,
    audience: activityAudienceSchema,
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
  })
  .superRefine((input, ctx) => {
    checkDefinition(input.type, input.definition, ctx);
    if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'پایان باید بعد از شروع باشه' });
    }
  })
  .transform((input) => ({ ...input, definition: forType(input.type, input.definition) }));

export const activityListQuerySchema = z.object({
  status: z.enum(['draft', 'scheduled', 'published', 'paused', 'closed', 'archived']).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  search: z.string().max(50).transform((value) => cleanText(value, false)).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ENGAGEMENT_PAGE_SIZE),
});

export const activityStatusActionSchema = z.object({
  action: z.enum(['publish', 'pause', 'resume', 'close', 'archive']),
});

export const activityResultsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  categoryId: z.enum(CATEGORY_IDS).optional(),
});

export const audiencePreviewSchema = z.object({ audience: activityAudienceSchema });

export const submissionReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: paragraph(L.REASON_MAX).optional(),
});

export const xpRevokeSchema = z.object({
  reason: line(L.REASON_MAX, 'دلیل ابطال رو بنویس'),
});

export const reviewListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ENGAGEMENT_PAGE_SIZE),
});

// ─── Answers ─────────────────────────────────────────────────────────────────

const answerValueSchema = z.union([
  z.string().max(L.TEXT_ANSWER_MAX * 2),
  z.array(z.string().max(60)).max(L.OPTIONS_MAX),
  z.number().finite(),
]);

const answersSchema = z.record(keySchema, answerValueSchema);

/** `PUT /me/activities/:id/draft`. Shapes only: a draft may be half-done. */
export const activityDraftSchema = z.object({ answers: answersSchema });

/** `POST /me/activities/:id/submit`. Checked against the definition by `validateAnswers`. */
export const activitySubmitSchema = z.object({
  versionId: z.uuid({ error: 'نسخه‌ی فعالیت معتبر نیست' }),
  answers: answersSchema,
});

/** Why this answer does not do, or null. An absent answer is only wrong when required. */
export function answerError(question: PlayerQuestion, value: ActivityAnswerValue | undefined): string | null {
  const empty =
    value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
  if (empty) return question.required ? 'به این سؤال باید جواب بدی' : null;

  switch (question.kind) {
    case 'single':
      return typeof value === 'string' && question.options.some((option) => option.id === value)
        ? null
        : 'یکی از گزینه‌ها رو انتخاب کن';
    case 'multiple': {
      if (!Array.isArray(value)) return 'گزینه‌ها رو انتخاب کن';
      const known = new Set(question.options.map((option) => option.id));
      if (new Set(value).size !== value.length || value.some((id) => !known.has(id))) {
        return 'گزینه‌ها رو انتخاب کن';
      }
      return question.maxSelections && value.length > question.maxSelections
        ? `حداکثر ${fa(question.maxSelections)} مورد می‌تونی انتخاب کنی`
        : null;
    }
    case 'text':
      if (typeof value !== 'string') return 'جوابت رو بنویس';
      return value.trim().length > L.TEXT_ANSWER_MAX ? `حداکثر ${fa(L.TEXT_ANSWER_MAX)} کاراکتر` : null;
    case 'rating':
      return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= question.max
        ? null
        : 'یک امتیاز انتخاب کن';
    case 'scale':
      return typeof value === 'number' && Number.isInteger(value) && value >= question.min && value <= question.max
        ? null
        : 'یک مقدار روی طیف انتخاب کن';
  }
}

/**
 * Checks a full set of answers against the questions, and returns them
 * cleaned: text trimmed, unanswered optional questions and ids that are not
 * questions dropped. The same function runs in the player and in the API.
 */
export function validateAnswers(
  questions: readonly PlayerQuestion[],
  answers: ActivityAnswers
): { ok: true; answers: ActivityAnswers } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const cleaned: ActivityAnswers = {};

  for (const question of questions) {
    const raw = answers[question.id];
    const value = typeof raw === 'string' ? cleanText(raw, true) : raw;
    const error = answerError(question, value);
    if (error) errors[question.id] = error;
    else if (value !== undefined && !(typeof value === 'string' && value === '') && !(Array.isArray(value) && value.length === 0)) {
      cleaned[question.id] = value;
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, answers: cleaned };
}

export type ActivityInputInput = z.input<typeof activityInputSchema>;
export type ActivityInputOutput = z.output<typeof activityInputSchema>;
export type ActivityListQueryOutput = z.output<typeof activityListQuerySchema>;
export type ActivityResultsQueryOutput = z.output<typeof activityResultsQuerySchema>;
export type SubmissionReviewOutput = z.output<typeof submissionReviewSchema>;
export type ReviewListQueryOutput = z.output<typeof reviewListQuerySchema>;
