/**
 * The rules a form is judged by, on both sides.
 *
 * `apps/admin` parses with these before it autosaves, `apps/web` before it
 * submits an answer, and `apps/api` parses with the same schemas in its
 * controllers — where the decision actually is. A client that skips the check
 * gets the same answer.
 *
 * Two different things are validated here, and they are easy to confuse:
 *
 *   - the **document**: is this a well-formed form? (the builder's saves)
 *   - the **answers**: does this response satisfy the form's own rules?
 *
 * Only the first is a fixed schema. The second depends on the form being
 * answered, so it is built at runtime by `answerValueSchema` from the question
 * itself.
 */

import { z } from 'zod';

import { toLatinDigits } from './common';

/** Titles are what a respondent reads, so an empty one is not a form. */
const titleSchema = z
  .string()
  .trim()
  .min(2, 'عنوان باید حداقل ۲ نویسه باشد')
  .max(160, 'عنوان طولانی‌تر از حد مجاز است');

const richTextSchema = z.string().trim().max(2000, 'متن طولانی‌تر از حد مجاز است');

export const formStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'CLOSED']);

export const formCategorySchema = z.enum([
  'FEEDBACK',
  'SURVEY',
  'CHECKLIST',
  'REQUEST',
  'ASSESSMENT',
  'OTHER',
]);

export const questionTypeSchema = z.enum([
  'SHORT_TEXT',
  'LONG_TEXT',
  'NUMBER',
  'EMAIL',
  'PHONE',
  'URL',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'DROPDOWN',
  'IMAGE_CHOICE',
  'YES_NO',
  'RATING_STARS',
  'NUMERIC_SCALE',
  'NPS',
  'SLIDER',
  'RANKING',
  'DATE',
  'TIME',
  'FILE_UPLOAD',
  'MATRIX',
  'SIGNATURE',
  'HEADING',
  'DESCRIPTION',
  'DIVIDER',
  'IMAGE',
]);

// ─── The document ────────────────────────────────────────────────────────────

export const formOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().max(200, 'متن گزینه طولانی‌تر از حد مجاز است'),
  imageUrl: z.string().trim().max(500).optional(),
});

export const questionValidationSchema = z.object({
  minLength: z.coerce.number().int().min(0).max(10000).optional(),
  maxLength: z.coerce.number().int().min(1).max(10000).optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  step: z.coerce.number().positive().optional(),
  scaleMax: z.coerce.number().int().min(2).max(100).optional(),
  minLabel: z.string().trim().max(60).optional(),
  maxLabel: z.string().trim().max(60).optional(),
  allowedFileTypes: z.array(z.string().trim().max(20)).max(20).optional(),
  maxFileSizeMb: z.coerce.number().int().min(1).max(100).optional(),
  minSelections: z.coerce.number().int().min(0).max(100).optional(),
  maxSelections: z.coerce.number().int().min(1).max(100).optional(),
});

export const questionSettingsSchema = z.object({
  allowOther: z.boolean().optional(),
  randomize: z.boolean().optional(),
  rows: z.array(z.string().trim().max(200)).max(30).optional(),
  columns: z.array(z.string().trim().max(200)).max(30).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  backgroundImageUrl: z.string().trim().max(500).optional(),
});

export const formQuestionSchema = z.object({
  id: z.string().min(1),
  pageId: z.string().min(1),
  type: questionTypeSchema,
  // Not `titleSchema`: a heading may legitimately be short, and a question the
  // author has not named yet must still be saveable — the publish check is
  // what refuses to send an unnamed question to a respondent.
  title: z.string().trim().max(500, 'عنوان پرسش طولانی‌تر از حد مجاز است'),
  description: richTextSchema.optional(),
  required: z.boolean(),
  order: z.coerce.number().int().min(0),
  placeholder: z.string().trim().max(200).optional(),
  defaultValue: z.string().trim().max(500).optional(),
  options: z.array(formOptionSchema).max(100, 'تعداد گزینه‌ها بیش از حد مجاز است').optional(),
  validation: questionValidationSchema.optional(),
  settings: questionSettingsSchema.optional(),
});

export const formPageSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(160),
  description: richTextSchema.optional(),
  order: z.coerce.number().int().min(0),
});

export const logicRuleSchema = z.object({
  id: z.string().min(1),
  whenQuestionId: z.string().min(1),
  operator: z.enum([
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'GREATER_THAN',
    'LESS_THAN',
    'IS_ANSWERED',
    'IS_EMPTY',
  ]),
  value: z.string().trim().max(200).optional(),
  action: z.enum(['SHOW', 'HIDE', 'JUMP_TO_PAGE', 'END_FORM']),
  targetQuestionId: z.string().min(1).optional(),
  targetPageId: z.string().min(1).optional(),
});

export const formAudienceSchema = z.object({
  mode: z.enum(['EVERYONE', 'USERS', 'ROLES', 'GROUPS']),
  userIds: z.array(z.string().min(1)).max(1000).optional(),
  roles: z.array(z.string().min(1)).max(50).optional(),
  groupIds: z.array(z.string().min(1)).max(100).optional(),
});

/** An ISO calendar date, `YYYY-MM-DD`. The UI collects it in the Jalali calendar. */
const isoDateSchema = z
  .string()
  .transform((value) => toLatinDigits(value).trim())
  .refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value), { message: 'تاریخ را کامل وارد کنید' })
  .refine(
    (value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { message: 'تاریخ معتبر نیست' }
  );

export const formSettingsSchema = z.object({
  welcome: z.object({
    enabled: z.boolean(),
    title: z.string().trim().max(160),
    description: richTextSchema.optional(),
    imageUrl: z.string().trim().max(500).optional(),
    buttonLabel: z.string().trim().max(60),
  }),
  thankYou: z.object({
    title: z.string().trim().max(160),
    description: richTextSchema.optional(),
    buttonLabel: z.string().trim().max(60).optional(),
    buttonUrl: z.string().trim().max(500).optional(),
  }),
  availability: z
    .object({
      alwaysAvailable: z.boolean(),
      publishAt: isoDateSchema.optional(),
      closeAt: isoDateSchema.optional(),
    })
    // A window that closes before it opens would silently never be answerable.
    .refine(
      (value) =>
        !value.publishAt || !value.closeAt || value.publishAt <= value.closeAt,
      { message: 'تاریخ پایان نمی‌تواند پیش از تاریخ شروع باشد', path: ['closeAt'] }
    ),
  responses: z.object({
    anonymous: z.boolean(),
    onePerUser: z.boolean(),
    allowEditAfterSubmit: z.boolean(),
  }),
  notifications: z.object({
    notifyAdminOnResponse: z.boolean(),
    sendConfirmationToRespondent: z.boolean(),
  }),
  showProgress: z.boolean(),
});

// ─── Request bodies ──────────────────────────────────────────────────────────

export const createFormSchema = z.object({
  title: titleSchema,
  description: richTextSchema.optional(),
  category: formCategorySchema.optional(),
  templateId: z.string().min(1).optional(),
});

/**
 * What the builder autosaves: whatever changed, and nothing else.
 *
 * An empty body is refused rather than treated as a no-op — an autosave that
 * sends nothing is a bug in the caller, not a save.
 */
export const updateFormSchema = z
  .object({
    title: titleSchema.optional(),
    description: richTextSchema.optional(),
    category: formCategorySchema.optional(),
    pages: z.array(formPageSchema).min(1, 'فرم باید حداقل یک صفحه داشته باشد').max(50).optional(),
    questions: z.array(formQuestionSchema).max(300, 'تعداد پرسش‌ها بیش از حد مجاز است').optional(),
    conditionalLogic: z.array(logicRuleSchema).max(200).optional(),
    audience: formAudienceSchema.optional(),
    settings: formSettingsSchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'موردی برای ذخیره ارسال نشده است',
  });

export const formsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: formStatusSchema.optional(),
  sort: z.enum(['RECENT', 'TITLE', 'RESPONSES']).default('RECENT'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const responsesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

export const exportQuerySchema = z.object({
  format: z.enum(['CSV', 'EXCEL']).default('CSV'),
});

/**
 * A submitted answer, before the form's own rules are applied.
 *
 * The value is deliberately loose here: what a valid answer looks like depends
 * on the question, and only the service has the question in hand. It checks
 * them with `answerValueSchema` below.
 */
/**
 * An uploaded image, as base64.
 *
 * The size is checked here in characters and again in bytes by the service:
 * base64 is about a third larger than the bytes it encodes, so the limit below
 * is deliberately generous and the real one is the decoded length.
 */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export const uploadAssetSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_IMAGE_TYPES, {
    message: 'فقط تصویر با فرمت PNG، JPEG، WEBP یا GIF مجاز است',
  }),
  data: z
    .string()
    .min(1, 'فایلی انتخاب نشده است')
    .max(Math.ceil((IMAGE_MAX_BYTES * 4) / 3) + 1024, 'حجم تصویر بیش از حد مجاز است'),
});

export type UploadAssetInput = z.output<typeof uploadAssetSchema>;

export const formAnswerSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([
    z.string().max(5000),
    z.number(),
    z.array(z.string().max(500)).max(100),
    z.record(z.string(), z.string().max(500)),
    z.null(),
  ]),
});

export const submitResponseSchema = z.object({
  answers: z.array(formAnswerSchema).max(300),
  complete: z.boolean(),
  elapsedSeconds: z.coerce.number().int().min(0).max(86_400).optional(),
});

export type CreateFormInput = z.output<typeof createFormSchema>;
export type UpdateFormInput = z.output<typeof updateFormSchema>;
export type FormsQueryInput = z.output<typeof formsQuerySchema>;
export type ResponsesQueryInput = z.output<typeof responsesQuerySchema>;
export type ExportQueryInput = z.output<typeof exportQuerySchema>;
export type SubmitResponseInput = z.output<typeof submitResponseSchema>;
