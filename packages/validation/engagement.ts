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
  COVER_ENTRY_EFFECTS,
  JOURNEY_LIMITS as J,
  JOURNEY_DAY_END_DEFAULTS as DAY_END,
  MOTION_DURATION,
  EXPLANATION_MAX,
  isQuizType,
  RESULT_CARD,
  THIS_OR_THAT_LIMITS as T,
  UNDIMENSIONED_KINDS,
  WORLD_LIMITS,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import { isTimeZone, zonedMidnight } from '@hamdastan/shared/time-zone';
import type {
  ActivityAnswers,
  ActivityAnswerValue,
  ActivityDefinition,
  ActivityQuestion,
  ActivityStep,
  ActivityType,
  PlayerQuestion,
} from '@hamdastan/types';

import { z } from 'zod';

import { phoneSchema } from './auth';
import { cleanText, line, paragraph, uniqueIdsSchema, uuidSchema } from './common';
import { mediaIdSchema, motionOff, motionSettingSchema } from './media';
import { interestCategoryIdsSchema } from './onboarding';

const fa = (n: number) => toPersianDigits(n);

/** Ids are minted by the builder; the API only checks they are tame. */
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, { error: 'شناسه معتبر نیست' });

// ─── Definition ──────────────────────────────────────────────────────────────

// The label is required of a text option only; `checkDefinition` says so, as the style decides it.
const optionSchema = z.object({
  id: keySchema,
  label: line(L.OPTION_LABEL_MAX, null),
  imageId: mediaIdSchema.optional(),
  correct: z.boolean().optional(),
  score: z.number().int().min(-L.DIMENSION_SCORE_MAX).max(L.DIMENSION_SCORE_MAX).optional(),
  dimensionScores: z
    .record(
      keySchema,
      z
        .number({ error: 'امتیاز باید عدد باشد' })
        .int({ error: 'امتیاز باید عدد صحیح باشد' })
        .min(-L.DIMENSION_SCORE_MAX, { error: `امتیاز بین ${fa(-L.DIMENSION_SCORE_MAX)} و ${fa(L.DIMENSION_SCORE_MAX)} است` })
        .max(L.DIMENSION_SCORE_MAX, { error: `امتیاز بین ${fa(-L.DIMENSION_SCORE_MAX)} و ${fa(L.DIMENSION_SCORE_MAX)} است` })
    )
    .optional(),
  traits: z.record(keySchema, z.number().int().min(-J.TRAIT_POINTS_MAX).max(J.TRAIT_POINTS_MAX)).optional(),
  weights: z
    .record(
      keySchema,
      z
        .number({ error: 'وزن باید عدد باشد' })
        .int({ error: 'وزن باید عدد صحیح باشد' })
        .min(-L.PROFILE_WEIGHT_MAX, { error: `وزن بین ${fa(-L.PROFILE_WEIGHT_MAX)} و ${fa(L.PROFILE_WEIGHT_MAX)} است` })
        .max(L.PROFILE_WEIGHT_MAX, { error: `وزن بین ${fa(-L.PROFILE_WEIGHT_MAX)} و ${fa(L.PROFILE_WEIGHT_MAX)} است` })
    )
    .optional(),
});

const questionBase = {
  id: keySchema,
  title: line(L.DESCRIPTION_MAX, 'متن سؤال را وارد کنید'),
  description: paragraph(L.DESCRIPTION_MAX).optional(),
  required: z.boolean(),
  dimensionId: keySchema.optional(),
  reverse: z.boolean().optional(),
  weight: z
    .number({ error: 'ضریب سؤال باید عدد باشد' })
    .int({ error: 'ضریب سؤال باید عدد صحیح باشد' })
    .min(0, { error: `ضریب سؤال بین ۰ و ${fa(L.QUESTION_WEIGHT_MAX)} است` })
    .max(L.QUESTION_WEIGHT_MAX, { error: `ضریب سؤال بین ۰ و ${fa(L.QUESTION_WEIGHT_MAX)} است` })
    .optional(),
  imageId: mediaIdSchema.optional(),
  imagePosition: z.enum(['above', 'below']).optional(),
  motion: motionSettingSchema.optional(),
};

const choiceFields = {
  ...questionBase,
  explanation: paragraph(EXPLANATION_MAX).optional(),
  optionStyle: z.enum(['text', 'image']).optional(),
  options: z
    .array(optionSchema)
    .min(L.OPTIONS_MIN, { error: `حداقل ${fa(L.OPTIONS_MIN)} گزینه لازم است` })
    .max(L.OPTIONS_MAX, { error: `حداکثر ${fa(L.OPTIONS_MAX)} گزینه` }),
};

const matchingPairSchema = z.object({
  id: keySchema,
  prompt: line(L.MATCHING_LABEL_MAX, 'متن سمت اول را وارد کنید'),
  matchId: keySchema,
  match: line(L.MATCHING_LABEL_MAX, 'متن جفت آن را وارد کنید'),
});

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
  z.object({
    ...questionBase,
    kind: z.literal('matching'),
    explanation: paragraph(EXPLANATION_MAX).optional(),
    pairs: z
      .array(matchingPairSchema)
      .min(L.MATCHING_PAIRS_MIN, { error: `حداقل ${fa(L.MATCHING_PAIRS_MIN)} جفت لازم است` })
      .max(L.MATCHING_PAIRS_MAX, { error: `حداکثر ${fa(L.MATCHING_PAIRS_MAX)} جفت` }),
  }),
]);

const coverSchema = z.object({
  headline: line(J.COVER_HEADLINE_MAX, null),
  text: paragraph(J.COVER_TEXT_MAX),
  buttonLabel: line(J.COVER_BUTTON_MAX, 'متن دکمه‌ی شروع را وارد کنید'),
  background: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { error: 'رنگ معتبر نیست' })
    .transform((value) => value.toLowerCase())
    .nullable(),
  entryEffect: z.enum(COVER_ENTRY_EFFECTS),
  backgroundImageId: mediaIdSchema.nullable().default(null),
  mascot: motionSettingSchema.default(() => motionOff()),
});

const stepSchema = z.object({
  id: keySchema,
  title: line(L.TITLE_MAX, null),
  description: paragraph(L.DESCRIPTION_MAX).default(''),
  questions: z.array(activityQuestionSchema).min(1, { error: 'حداقل یک سؤال لازم است' }),
  cover: coverSchema.optional(),
  answerMotion: motionSettingSchema.optional(),
});

const xpSchema = z.object({
  enabled: z.boolean(),
  amount: z
    .number({ error: 'مقدار XP را وارد کنید' })
    .int({ error: 'XP باید عدد صحیح باشد' })
    .min(0, { error: 'XP نمی‌تواند منفی باشد' })
    .max(L.XP_MAX, { error: `حداکثر ${fa(L.XP_MAX)} XP` }),
  showBeforeStart: z.boolean(),
  maxAwards: z.number().int().min(1).max(L.REPEAT_MAX),
  requirePass: z.boolean(),
});

const assessmentSchema = z.object({
  mode: z.enum(['personality', 'knowledge', 'profile']),
  dimensions: z
    .array(
      z.object({
        id: keySchema,
        title: line(L.TITLE_MAX, 'عنوان بُعد را وارد کنید'),
        description: paragraph(L.DESCRIPTION_MAX).default(''),
        imageId: mediaIdSchema.optional(),
      })
    )
    .max(L.DIMENSIONS_MAX),
  profiles: z
    .array(
      z.object({
        id: keySchema,
        title: line(L.TITLE_MAX, 'عنوان پروفایل را وارد کنید'),
        description: paragraph(L.DESCRIPTION_MAX).default(''),
      })
    )
    .max(L.PROFILES_MAX, { error: `حداکثر ${fa(L.PROFILES_MAX)} پروفایل` })
    .optional(),
  tieBreak: z
    .object({
      priorityQuestionIds: z.array(keySchema).max(L.QUESTIONS_MAX),
      defaultProfileId: keySchema.nullable(),
    })
    .optional(),
  passingScore: z.number().int().min(0).max(100).nullable(),
  showResult: z.boolean(),
  // Absent on every version stored before answers could be revealed.
  revealAnswers: z.boolean().default(false),
});

const stepXp = z
  .number({ error: 'مقدار XP را وارد کنید' })
  .int({ error: 'XP باید عدد صحیح باشد' })
  .min(0, { error: 'XP نمی‌تواند منفی باشد' })
  .max(J.STEP_XP_MAX, { error: `حداکثر ${fa(J.STEP_XP_MAX)} XP` });

const journeySchema = z.object({
  unlockMode: z.enum(['calendar_day', 'rolling_24h']),
  timezone: z.string().max(60).refine(isTimeZone, { error: 'منطقه‌ی زمانی معتبر نیست' }),
  missedDays: z.enum(['catch_up', 'lock']),
  requirePreviousDay: z.boolean(),
  allowReview: z.boolean(),
  questionsPerDay: z.number().int().min(1).max(J.QUESTIONS_PER_DAY_MAX),
  rewards: z.object({ perQuestion: stepXp, perDay: stepXp }),
  // Absent on a journey saved before the day-end page existed.
  dayEnd: z
    .object({
      title: line(J.DAY_END_TITLE_MAX, 'متن تبریک را وارد کنید'),
      message: paragraph(J.DAY_END_MESSAGE_MAX),
      mascot: motionSettingSchema,
      invite: z.object({
        enabled: z.boolean(),
        text: paragraph(J.DAY_END_MESSAGE_MAX),
        button: line(J.COVER_BUTTON_MAX, 'متن دکمه‌ی دعوت را وارد کنید'),
        shareMessage: paragraph(J.SHARE_MESSAGE_MAX),
      }),
    })
    .default(() => journeyDayEndDefaults()),
  // Absent on a journey saved before results existed.
  result: z
    .object({
      enabled: z.boolean(),
      traits: z
        .array(z.object({ id: keySchema, title: line(J.CHARACTER_NAME_MAX, 'نام ویژگی را وارد کنید') }))
        .max(J.TRAITS_MAX, { error: `حداکثر ${fa(J.TRAITS_MAX)} ویژگی` }),
      characters: z
        .array(
          z.object({
            id: keySchema,
            name: line(J.CHARACTER_NAME_MAX, 'نام شخصیت را وارد کنید'),
            title: line(L.TITLE_MAX, null),
            description: paragraph(J.CHARACTER_DESCRIPTION_MAX),
            imageId: mediaIdSchema.nullable(),
            traitId: keySchema.nullable(),
          })
        )
        .max(J.CHARACTERS_MAX, { error: `حداکثر ${fa(J.CHARACTERS_MAX)} شخصیت` }),
      defaultCharacterId: keySchema.nullable(),
      card: z.object({
        brandName: line(J.BRAND_NAME_MAX, null),
        logoId: mediaIdSchema.nullable(),
        background: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, { error: 'رنگ معتبر نیست' })
          .transform((value) => value.toLowerCase())
          .nullable(),
        showUserName: z.boolean(),
      }),
    })
    .default(() => journeyResultDefaults()),
  // Absent on a journey saved before motions existed.
  motions: z
    .object({ answer: motionSettingSchema, dayComplete: motionSettingSchema, journeyComplete: motionSettingSchema })
    .default(() => ({
      answer: motionOff(MOTION_DURATION.ANSWER_MS),
      dayComplete: motionOff(MOTION_DURATION.DAY_COMPLETE_MS),
      journeyComplete: motionOff(MOTION_DURATION.JOURNEY_COMPLETE_MS),
    })),
});

// An image left unchosen is '' while the admin builds; `checkDefinition` asks for it.
const thisOrThatSchema = z.object({
  coverImageId: mediaIdSchema.nullable(),
  order: z.enum(['manual', 'random']),
  cards: z
    .array(z.object({ id: keySchema, imageId: z.union([z.literal(''), mediaIdSchema]), title: line(T.CARD_TITLE_MAX, null) }))
    .min(T.CARDS_MIN, { error: `حداقل ${fa(T.CARDS_MIN)} کارت لازم است` })
    .max(T.CARDS_MAX, { error: `حداکثر ${fa(T.CARDS_MAX)} کارت` }),
});

const definitionSchema = z.object({
  // The cap depends on the type — a journey runs longer — and «این یا اون» has none, so both are checked in `checkDefinition`.
  steps: z.array(stepSchema),
  estimatedMinutes: z.number().int().min(1).max(L.ESTIMATED_MINUTES_MAX),
  maxSubmissions: z.number().int().min(1).max(L.REPEAT_MAX),
  anonymous: z.boolean(),
  review: z.enum(['auto', 'manual']),
  assessment: assessmentSchema.nullable(),
  // Absent on every version stored before journeys existed.
  journey: journeySchema.nullable().default(null),
  // Absent on every version stored before «این یا اون» existed.
  thisOrThat: thisOrThatSchema.nullable().default(null),
  xp: xpSchema,
});

/**
 * Personality: a choice question once measured a single dimension
 * (`dimensionId`), each option scoring toward it (`score`), turned round
 * when reverse-keyed. Now each option scores any dimensions on its own
 * (`dimensionScores`). A question in the old shape comes out in the new
 * one with the same result; anything else is returned as it is. Stored
 * versions are read through this, so nothing after it knows the old shape.
 */
export function withDimensionScores(question: ActivityQuestion): ActivityQuestion {
  if ((question.kind !== 'single' && question.kind !== 'multiple') || !question.dimensionId) return question;
  const { dimensionId, reverse, ...rest } = question;
  return {
    ...rest,
    options: question.options.map(({ score, ...option }) => {
      const points = (reverse ? -1 : 1) * (score ?? 0);
      return points ? { ...option, dimensionScores: { ...option.dimensionScores, [dimensionId]: points } } : option;
    }),
  };
}

/** `withDimensionScores` over every question of a definition. */
export const definitionWithDimensionScores = (definition: ActivityDefinition): ActivityDefinition => ({
  ...definition,
  steps: definition.steps.map((step) => ({ ...step, questions: step.questions.map(withDimensionScores) })),
});

/**
 * Clears what does not belong to the type, so a builder that switched type
 * half-way cannot leave a survey with a reviewer or a mission anonymous.
 */
function forType(type: ActivityType, definition: ActivityDefinition): ActivityDefinition {
  const competition = type === 'competition';
  // A competition is always a knowledge quiz; its settings are an assessment's.
  const assessment = competition && definition.assessment
    ? { ...definition.assessment, mode: 'knowledge' as const, dimensions: [] }
    : type === 'assessment' ? definition.assessment : null;
  const knowledgePassMark = isQuizType(type) && assessment?.mode === 'knowledge' && assessment.passingScore !== null;
  const profile = assessment?.mode === 'profile';
  const dimensionIds = assessment?.mode === 'personality' ? new Set(assessment.dimensions.map((d) => d.id)) : new Set<string>();

  const journey = type === 'journey';
  const thisOrThat = type === 'this_or_that';
  // A journey is taken once, answer by answer; a competition once, against the clock; «این یا اون» once, to one pick.
  const maxSubmissions = journey || competition || thisOrThat ? 1 : definition.maxSubmissions;

  return {
    ...definition,
    // A cover, the motions and trait points are a journey's; any other type drops them. A question image stays.
    steps: (type === 'mission' || journey ? definition.steps : definition.steps.slice(0, thisOrThat ? 0 : 1))
      .map(withOptionStyle)
      .map((step) => (profile ? step : withoutProfileWeights(step)))
      .map((step) => withDimensionsOf(step, dimensionIds))
      .map((step) =>
      journey
        ? step
        : {
            ...step,
            cover: undefined,
            answerMotion: undefined,
            questions: step.questions.map((question) =>
              'options' in question
                ? { ...question, motion: undefined, options: question.options.map((option) => ({ ...option, traits: undefined })) }
                : { ...question, motion: undefined }
            ),
          }
    ),
    maxSubmissions,
    anonymous: type === 'survey' && definition.anonymous,
    review: type === 'mission' ? definition.review : 'auto',
    // Profiles and their tie rules are a profile assessment's; any other mode drops them.
    assessment: assessment && !profile ? { ...assessment, profiles: undefined, tieBreak: undefined } : assessment,
    journey: journey ? definition.journey : null,
    thisOrThat: thisOrThat ? definition.thisOrThat : null,
    xp: {
      ...definition.xp,
      maxAwards: Math.min(definition.xp.maxAwards, maxSubmissions),
      requirePass: knowledgePassMark && definition.xp.requirePass,
    },
  };
}

/**
 * Options follow their question's style: a text option keeps no picture,
 * and an image option left unnamed is named by its place — the name the
 * results, the CSV and a read-back show.
 */
function withOptionStyle(step: ActivityStep): ActivityStep {
  return {
    ...step,
    questions: step.questions.map((question) => {
      if (!('options' in question)) return question;
      const images = question.optionStyle === 'image';
      return {
        ...question,
        optionStyle: images ? 'image' : undefined,
        options: question.options.map((option, o) =>
          images
            ? { ...option, label: option.label || `تصویر ${fa(o + 1)}` }
            : { ...option, imageId: undefined }
        ),
      };
    }),
  };
}

/** A question's multiplier and its options' profile weights count only in a profile assessment. */
function withoutProfileWeights(step: ActivityStep): ActivityStep {
  return {
    ...step,
    questions: step.questions.map((question) =>
      'options' in question
        ? { ...question, weight: undefined, options: question.options.map((option) => ({ ...option, weights: undefined })) }
        : { ...question, weight: undefined }
    ),
  };
}

/**
 * Options keep points only toward dimensions that exist: none outside a
 * personality assessment, and none toward a dimension since removed.
 */
function withDimensionsOf(step: ActivityStep, dimensionIds: Set<string>): ActivityStep {
  return {
    ...step,
    questions: step.questions.map((question) =>
      'options' in question
        ? {
            ...question,
            options: question.options.map((option) => {
              const kept = Object.entries(option.dimensionScores ?? {}).filter(([id]) => dimensionIds.has(id));
              return { ...option, dimensionScores: kept.length ? Object.fromEntries(kept) : undefined };
            }),
          }
        : question
    ),
  };
}

/** The rules that need the whole activity in view. Paths point at the field to fix. */
function checkDefinition(type: ActivityType, definition: ActivityDefinition, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: 'custom', path: ['definition', ...path], message });

  if (type === 'this_or_that') {
    checkThisOrThat(definition, issue);
    return;
  }

  const journey = type === 'journey';
  const stepsMax = journey ? J.DAYS_MAX : L.STEPS_MAX;
  const questionsMax = journey ? J.QUESTIONS_MAX : L.QUESTIONS_MAX;
  const questions = definition.steps.flatMap((step) => step.questions);
  if (definition.steps.length === 0) issue(['steps'], 'حداقل یک مرحله لازم است');
  if (definition.steps.length > stepsMax) {
    issue(['steps'], journey ? `حداکثر ${fa(stepsMax)} روز` : `حداکثر ${fa(stepsMax)} مرحله`);
  }
  if (questions.length > questionsMax) issue(['steps'], `حداکثر ${fa(questionsMax)} سؤال`);
  if (journey && !definition.journey) issue(['journey'], 'تنظیمات باز شدن روزها را کامل کنید');
  if (journey && definition.journey) checkResult(definition, issue);

  const ids = new Set<string>();
  definition.steps.forEach((step, s) => {
    if (type === 'mission' && !step.title) issue(['steps', s, 'title'], 'عنوان مرحله را وارد کنید');
    if (journey && !step.title) issue(['steps', s, 'title'], 'عنوان روز را وارد کنید');

    step.questions.forEach((question, q) => {
      const at = ['steps', s, 'questions', q];
      if (ids.has(question.id)) issue([...at, 'id'], 'شناسه‌ی سؤال تکراری است');
      ids.add(question.id);

      if (question.kind === 'single' || question.kind === 'multiple') {
        const optionIds = new Set(question.options.map((option) => option.id));
        if (optionIds.size !== question.options.length) issue([...at, 'options'], 'شناسه‌ی گزینه تکراری است');
        const images = question.optionStyle === 'image';
        question.options.forEach((option, o) => {
          if (images && !option.imageId) issue([...at, 'options', o, 'imageId'], 'تصویر گزینه را انتخاب کنید');
          if (!images && !option.label) issue([...at, 'options', o, 'label'], 'متن گزینه را وارد کنید');
        });
        if (question.kind === 'multiple' && (question.maxSelections ?? 0) > question.options.length) {
          issue([...at, 'maxSelections'], 'سقف انتخاب از تعداد گزینه‌ها بیشتر است');
        }
      }
      if (question.kind === 'matching') {
        const pairIds = question.pairs.flatMap((pair) => [pair.id, pair.matchId]);
        if (new Set(pairIds).size !== pairIds.length) issue([...at, 'pairs'], 'شناسه‌ی جفت تکراری است');
        // Two tiles that read the same could not be told apart on the screen.
        const sides = (labels: string[]) => new Set(labels).size !== labels.length;
        if (sides(question.pairs.map((pair) => pair.prompt)) || sides(question.pairs.map((pair) => pair.match))) {
          issue([...at, 'pairs'], 'متن‌های هر ستون باید با هم فرق داشته باشند');
        }
      }
      if (question.kind === 'scale' && question.min >= question.max) {
        issue([...at, 'max'], 'انتهای طیف باید بزرگ‌تر از ابتدای آن باشد');
      }
    });
  });

  if (!isQuizType(type)) return;
  const assessment = definition.assessment;
  if (!assessment) {
    issue(['assessment'], type === 'competition' ? 'تنظیمات مسابقه را کامل کنید' : 'نوع آزمون را انتخاب کنید');
    return;
  }

  // A competition is scored as knowledge whatever its mode says; `forType` sets it so.
  if (assessment.mode === 'profile' && type !== 'competition') {
    checkProfiles(definition, issue);
    return;
  }

  if (assessment.mode === 'personality' && type !== 'competition') {
    if (assessment.dimensions.length === 0) issue(['assessment', 'dimensions'], 'حداقل یک بُعد لازم است');
    const dimensionIds = new Set(assessment.dimensions.map((dimension) => dimension.id));
    definition.steps.forEach((step, s) =>
      step.questions.forEach((question, q) => {
        if (UNDIMENSIONED_KINDS.includes(question.kind)) return;
        if (question.kind === 'single' || question.kind === 'multiple') {
          const scored = question.options.some((option) =>
            Object.entries(option.dimensionScores ?? {}).some(([id, points]) => points !== 0 && dimensionIds.has(id))
          );
          if (!scored) issue(['steps', s, 'questions', q, 'dimensionScores'], 'امتیاز گزینه‌ها را دست‌کم برای یک بُعد وارد کنید');
          return;
        }
        if (!question.dimensionId || !dimensionIds.has(question.dimensionId)) {
          issue(['steps', s, 'questions', q, 'dimensionId'], 'بُعدی را که این سؤال می‌سنجد انتخاب کنید');
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
          question.kind === 'single' ? 'یک گزینه‌ی درست مشخص کنید' : 'حداقل یک گزینه‌ی درست مشخص کنید'
        );
      }
    })
  );
  // A matching question carries its own key, so it scores without one being marked.
  if (!questions.some((question) => question.kind === 'single' || question.kind === 'multiple' || question.kind === 'matching')) {
    issue(['steps'], 'آزمون دانشی دست‌کم به یک سؤال گزینه‌ای یا تطبیقی نیاز دارد');
  }
}

/**
 * A profile assessment: profiles to come out as, each with its own title,
 * weights only toward profiles that exist, priority questions that are
 * choice questions of this activity, and a default profile — so a tie
 * always ends in one result.
 */
function checkProfiles(definition: ActivityDefinition, issue: (path: (string | number)[], message: string) => void) {
  const settings = definition.assessment!;
  const profiles = settings.profiles ?? [];
  const at = ['assessment'];
  const profileIds = new Set(profiles.map((profile) => profile.id));

  if (profiles.length < 2) issue([...at, 'profiles'], 'حداقل دو پروفایل نتیجه تعریف کنید');
  if (profileIds.size !== profiles.length) issue([...at, 'profiles'], 'شناسه‌ی پروفایل تکراری است');
  const titles = profiles.map((profile) => profile.title);
  if (new Set(titles).size !== titles.length) issue([...at, 'profiles'], 'عنوان پروفایل‌ها باید با هم فرق داشته باشد');

  const choiceIds = new Set<string>();
  definition.steps.forEach((step, s) =>
    step.questions.forEach((question, q) => {
      if (question.kind !== 'single' && question.kind !== 'multiple') return;
      choiceIds.add(question.id);
      question.options.forEach((option, o) => {
        if (Object.keys(option.weights ?? {}).some((id) => !profileIds.has(id))) {
          issue(['steps', s, 'questions', q, 'options', o, 'weights'], 'وزن برای پروفایلی ثبت شده که وجود ندارد');
        }
      });
    })
  );
  if (choiceIds.size === 0) issue(['steps'], 'پروفایل‌سنجی دست‌کم به یک سؤال گزینه‌ای نیاز دارد');

  const tieBreak = settings.tieBreak ?? { priorityQuestionIds: [], defaultProfileId: null };
  if (new Set(tieBreak.priorityQuestionIds).size !== tieBreak.priorityQuestionIds.length) {
    issue([...at, 'tieBreak', 'priorityQuestionIds'], 'یک سؤال دو بار در اولویت‌ها آمده است');
  }
  if (tieBreak.priorityQuestionIds.some((id) => !choiceIds.has(id))) {
    issue([...at, 'tieBreak', 'priorityQuestionIds'], 'سؤال اولویت‌دار باید یکی از سؤال‌های گزینه‌ای همین آزمون باشد');
  }
  if (!tieBreak.defaultProfileId || !profileIds.has(tieBreak.defaultProfileId)) {
    issue([...at, 'tieBreak', 'defaultProfileId'], 'پروفایل پیش‌فرض را انتخاب کنید');
  }
}

/** «این یا اون»: every card has its own id and an image. */
function checkThisOrThat(definition: ActivityDefinition, issue: (path: (string | number)[], message: string) => void) {
  const settings = definition.thisOrThat;
  if (!settings) {
    issue(['thisOrThat'], 'کارت‌های این فعالیت را اضافه کنید');
    return;
  }
  if (new Set(settings.cards.map((card) => card.id)).size !== settings.cards.length) {
    issue(['thisOrThat', 'cards'], 'شناسه‌ی کارت تکراری است');
  }
  settings.cards.forEach((card, c) => {
    if (!card.imageId) issue(['thisOrThat', 'cards', c, 'imageId'], 'تصویر کارت را انتخاب کنید');
  });
}

/**
 * A journey campaign ends at midnight after its last calendar day, in its
 * own zone: a 7-day journey starting on Saturday ends as Friday does.
 */
function journeyEnd(input: { type: ActivityType; startsAt: string | null; definition: ActivityDefinition }): string | null {
  const { journey, steps } = input.definition;
  if (input.type !== 'journey' || !journey || !input.startsAt) return null;
  return zonedMidnight(new Date(input.startsAt), journey.timezone, steps.length).toISOString();
}

/** The day-end page a journey starts with. */
export function journeyDayEndDefaults() {
  return {
    title: DAY_END.TITLE,
    message: DAY_END.MESSAGE,
    mascot: motionOff(MOTION_DURATION.DAY_COMPLETE_MS),
    invite: {
      enabled: true,
      text: DAY_END.INVITE_TEXT,
      button: DAY_END.INVITE_BUTTON,
      shareMessage: DAY_END.SHARE_MESSAGE,
    },
  };
}

/** A journey's results: characters to come out as, a default, and points only for traits that exist. */
function checkResult(definition: ActivityDefinition, issue: (path: (string | number)[], message: string) => void) {
  const result = definition.journey!.result;
  if (!result?.enabled) return;
  const at = ['journey', 'result'];
  const traitIds = new Set(result.traits.map((trait) => trait.id));

  if (traitIds.size !== result.traits.length) issue([...at, 'traits'], 'شناسه‌ی ویژگی تکراری است');
  if (result.characters.length === 0) issue([...at, 'characters'], 'حداقل یک شخصیت تعریف کنید');
  if (!result.characters.some((character) => character.id === result.defaultCharacterId)) {
    issue([...at, 'defaultCharacterId'], 'نتیجه‌ی پیش‌فرض را انتخاب کنید');
  }
  const claimed = new Set<string>();
  result.characters.forEach((character, c) => {
    if (!character.traitId) return;
    if (!traitIds.has(character.traitId)) issue([...at, 'characters', c, 'traitId'], 'این ویژگی دیگر وجود ندارد');
    else if (claimed.has(character.traitId)) issue([...at, 'characters', c, 'traitId'], 'هر ویژگی فقط به یک شخصیت اختصاص می‌یابد');
    claimed.add(character.traitId);
  });
  definition.steps.forEach((step, s) =>
    step.questions.forEach((question, q) => {
      if (!('options' in question)) return;
      question.options.forEach((option, o) => {
        if (Object.keys(option.traits ?? {}).some((id) => !traitIds.has(id))) {
          issue(['steps', s, 'questions', q, 'options', o, 'traits'], 'امتیاز برای ویژگی‌ای ثبت شده که وجود ندارد');
        }
      });
    })
  );
}

/** A journey's results, before the admin sets any: off, with the product's card. */
export function journeyResultDefaults() {
  return {
    enabled: false,
    traits: [],
    characters: [],
    defaultCharacterId: null,
    card: { brandName: RESULT_CARD.BRAND, logoId: null, background: null, showUserName: true },
  };
}

// ─── Audience ────────────────────────────────────────────────────────────────

export const activityAudienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('users'),
    phones: z
      .array(phoneSchema)
      .min(1, { error: 'حداقل یک شماره وارد کنید' })
      .max(L.AUDIENCE_PHONES_MAX, { error: `حداکثر ${fa(L.AUDIENCE_PHONES_MAX)} شماره` })
      .transform((phones) => [...new Set(phones)]),
  }),
  z.object({
    kind: z.literal('interests'),
    categoryIds: interestCategoryIdsSchema,
  }),
]);

// ─── Activity ────────────────────────────────────────────────────────────────

const dateTimeSchema = z.iso.datetime({ offset: true, error: 'تاریخ معتبر نیست' }).nullable();

/** `POST /admin/engagement/activities` and `PUT …/:id`. */
export const activityInputSchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES, { error: 'نوع فعالیت را انتخاب کنید' }),
    title: line(L.TITLE_MAX, 'عنوان را وارد کنید'),
    summary: line(L.SUMMARY_MAX, null),
    instructions: paragraph(L.DESCRIPTION_MAX),
    // A choice question stored in the old single-dimension shape is checked and saved in the new one.
    definition: definitionSchema.transform(definitionWithDimensionScores),
    audience: activityAudienceSchema,
    startsAt: dateTimeSchema,
    endsAt: dateTimeSchema,
    worldIds: uniqueIdsSchema(WORLD_LIMITS.FILED_UNDER_MAX, 'دنیا').default([]),
  })
  .superRefine((input, ctx) => {
    checkDefinition(input.type, input.definition, ctx);
    if (input.type === 'journey' && !input.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'زمان شروع کمپین را مشخص کنید' });
    }
    // A competition is a race: everyone shares the same window.
    if (input.type === 'competition') {
      if (!input.startsAt) ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'زمان شروع مسابقه را مشخص کنید' });
      if (!input.endsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'زمان پایان مسابقه را مشخص کنید' });
    }
    // A journey's end is derived from its start, so only the others are checked.
    if (input.type !== 'journey' && input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'زمان پایان باید بعد از زمان شروع باشد' });
    }
  })
  .transform((input) => ({
    ...input,
    definition: forType(input.type, input.definition),
    endsAt: journeyEnd(input) ?? input.endsAt,
  }));

export const activityListQuerySchema = z.object({
  status: z.enum(['draft', 'scheduled', 'published', 'paused', 'closed', 'archived']).optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  search: z.string().max(50).transform((value) => cleanText(value, false)).optional(),
  world: uuidSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(ENGAGEMENT_PAGE_SIZE),
});

export const activityStatusActionSchema = z.object({
  action: z.enum(['publish', 'pause', 'resume', 'close', 'archive']),
});

export const activityResultsQuerySchema = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  categoryId: z.string().trim().min(1).max(40).optional(),
});

export const audiencePreviewSchema = z.object({ audience: activityAudienceSchema });

export const submissionReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: paragraph(L.REASON_MAX).optional(),
});

export const xpRevokeSchema = z.object({
  reason: line(L.REASON_MAX, 'دلیل ابطال را وارد کنید'),
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

/**
 * `POST /me/activities/:id/answers` — one answer to a journey question.
 * `null` skips an optional question; the API checks it against the question.
 */
export const journeyAnswerSchema = z.object({
  questionId: keySchema,
  value: answerValueSchema.nullable(),
});

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
    case 'matching': {
      // One match per prompt, each match used once: a half-matched question is not an answer.
      const known = new Set(question.matches.map((match) => match.id));
      return Array.isArray(value) &&
        value.length === question.prompts.length &&
        new Set(value).size === value.length &&
        value.every((id) => known.has(id))
        ? null
        : 'همه‌ی موردها رو به جفتشون وصل کن';
    }
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
