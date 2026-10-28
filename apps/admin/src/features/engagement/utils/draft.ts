import {
  ENGAGEMENT_LIMITS,
  isQuizType,
  JOURNEY_DEFAULTS,
  JOURNEY_LIMITS,
  MOTION_DURATION,
  THIS_OR_THAT_LIMITS,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type {
  ActivityDefinition,
  ActivityInput,
  ActivityQuestion,
  ActivityStep,
  ActivityType,
  AdminActivityDetail,
  DailyCover,
  MatchingPair,
  ThisOrThatCard,
} from '@hamdastan/types';
import { definitionWithDimensionScores, journeyDayEndDefaults, journeyResultDefaults, motionOff } from '@hamdastan/validation';

/**
 * The builder's working copy and the blank pieces it starts from.
 *
 * The working copy is an `ActivityInput` with its two dates as the
 * `datetime-local` strings the inputs hold; `toInput` turns it back into
 * what the API takes. Nothing here validates — `activityInputSchema` does,
 * on save, exactly as the API will.
 */

export type EditorState = Omit<ActivityInput, 'startsAt' | 'endsAt'> & {
  startsAt: string;
  endsAt: string;
};

/** A short id for a step, question or option. Ids only have to be unique inside one activity. */
export const newKey = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export function emptyQuestion(kind: ActivityQuestion['kind'], keep?: Partial<ActivityQuestion>): ActivityQuestion {
  const base = {
    id: keep?.id ?? newKey(),
    title: keep?.title ?? '',
    description: keep?.description,
    required: keep?.required ?? true,
    dimensionId: keep?.dimensionId,
    reverse: keep?.reverse,
    weight: keep?.weight,
    imageId: keep?.imageId,
    imagePosition: keep?.imagePosition,
    motion: keep?.motion,
  };
  switch (kind) {
    case 'single':
    case 'multiple':
      return {
        ...base,
        kind,
        optionStyle: keep && 'optionStyle' in keep ? keep.optionStyle : undefined,
        options:
          keep && 'options' in keep && keep.options
            ? keep.options
            : [
                { id: newKey(), label: '' },
                { id: newKey(), label: '' },
              ],
      };
    case 'text':
      return { ...base, kind, multiline: true, dimensionId: undefined, reverse: undefined };
    case 'rating':
      return { ...base, kind, max: 5 };
    case 'scale':
      return { ...base, kind, min: 1, max: 5, minLabel: 'کاملاً مخالفم', maxLabel: 'کاملاً موافقم' };
    case 'matching':
      return {
        ...base,
        kind,
        dimensionId: undefined,
        reverse: undefined,
        pairs: Array.from({ length: ENGAGEMENT_LIMITS.MATCHING_PAIRS_MIN }, emptyPair),
      };
  }
}

/** A blank pair; its match gets an id of its own, so the product never learns which goes with which. */
export const emptyPair = (): MatchingPair => ({ id: newKey(), prompt: '', matchId: newKey(), match: '' });

export const emptyStep = (title = ''): ActivityStep => ({
  id: newKey(),
  title,
  description: '',
  questions: [emptyQuestion('single')],
});

/** How many steps (a journey's days) and questions an activity of this type may hold. */
export const limitsFor = (type: ActivityType) =>
  type === 'journey'
    ? { steps: JOURNEY_LIMITS.DAYS_MAX, questions: JOURNEY_LIMITS.QUESTIONS_MAX }
    : { steps: ENGAGEMENT_LIMITS.STEPS_MAX, questions: ENGAGEMENT_LIMITS.QUESTIONS_MAX };

/** A journey day's title by its number: «روز ۳». */
export const dayTitle = (number: number) => `روز ${toPersianDigits(number)}`;

/** Nothing written in a question: no text, no option labels, no pairs. */
export function isBlankQuestion(question: ActivityQuestion): boolean {
  if (question.title.trim() !== '') return false;
  if ('pairs' in question) return question.pairs.every((pair) => pair.prompt.trim() === '' && pair.match.trim() === '');
  return !('options' in question) || question.options.every((option) => option.label.trim() === '' && !option.imageId);
}

/** A step as it was created: one blank question, no description, no cover. */
export const isUntouchedStep = (step: ActivityStep) =>
  step.questions.length === 1 && isBlankQuestion(step.questions[0]) && !step.description && !step.cover;

/** A day's cover before the admin writes one. */
export const emptyCover = (): DailyCover => ({
  headline: '',
  text: '',
  buttonLabel: 'بزن بریم!',
  background: null,
  entryEffect: 'fade',
  backgroundImageId: null,
  mascot: motionOff(),
});

/** A new journey: a week, a day per step, opening each calendar day in Tehran; earlier days stay open. */
const emptyJourney = (): NonNullable<ActivityDefinition['journey']> => ({
  unlockMode: 'calendar_day',
  timezone: JOURNEY_DEFAULTS.TIMEZONE,
  missedDays: 'catch_up',
  requirePreviousDay: false,
  allowReview: true,
  questionsPerDay: JOURNEY_DEFAULTS.QUESTIONS_PER_DAY,
  rewards: { perQuestion: 0, perDay: 10 },
  motions: {
    answer: motionOff(MOTION_DURATION.ANSWER_MS),
    dayComplete: motionOff(MOTION_DURATION.DAY_COMPLETE_MS),
    journeyComplete: motionOff(MOTION_DURATION.JOURNEY_COMPLETE_MS),
  },
  dayEnd: journeyDayEndDefaults(),
  result: journeyResultDefaults(),
});

/** A «این یا اون» card before its image is chosen. */
export const emptyCard = (imageId = ''): ThisOrThatCard => ({ id: newKey(), imageId, title: '' });

export function emptyDefinition(type: ActivityType): ActivityDefinition {
  const thisOrThat = type === 'this_or_that';
  const steps =
    type === 'journey'
      ? Array.from({ length: JOURNEY_DEFAULTS.DAYS }, (_, i) => emptyStep(dayTitle(i + 1)))
      : thisOrThat
        ? []
        : [emptyStep(type === 'mission' ? 'مرحله‌ی ۱' : '')];
  return {
    steps,
    estimatedMinutes: type === 'survey' || thisOrThat ? 3 : 5,
    maxSubmissions: 1,
    anonymous: false,
    review: type === 'mission' ? 'manual' : 'auto',
    assessment: isQuizType(type) ? { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true, revealAnswers: false } : null,
    journey: type === 'journey' ? emptyJourney() : null,
    thisOrThat: thisOrThat
      ? { coverImageId: null, order: 'manual', cards: Array.from({ length: THIS_OR_THAT_LIMITS.CARDS_DEFAULT }, () => emptyCard()) }
      : null,
    xp: { enabled: true, amount: 20, showBeforeStart: true, maxAwards: 1, requirePass: false },
  };
}

export function emptyState(type: ActivityType = 'survey'): EditorState {
  return {
    type,
    title: '',
    summary: '',
    instructions: '',
    definition: emptyDefinition(type),
    audience: { kind: 'all' },
    startsAt: '',
    endsAt: '',
    worldIds: [],
  };
}

/**
 * A new type keeps the content that still fits it: the title and the
 * questions. A journey keeps its week of days — the first holds the
 * questions already written — and every day is titled. «این یا اون» has
 * cards instead of questions; it keeps its cards while the admin looks at
 * another type and back, as the others keep their questions.
 */
export function switchType(state: EditorState, type: ActivityType): EditorState {
  const blank = emptyDefinition(type);
  const multiStep = (t: ActivityType) => t === 'mission' || t === 'journey';
  const thisOrThat = state.definition.thisOrThat ?? blank.thisOrThat;
  let steps: ActivityStep[];
  // Questions are kept (unsaved — the API drops them) while «این یا اون» is looked at, and come back with the type.
  if (type === 'this_or_that') steps = state.definition.steps;
  else if (state.definition.steps.length === 0) steps = blank.steps;
  else if (multiStep(type) && multiStep(state.type)) steps = state.definition.steps;
  else if (multiStep(type)) steps = [{ ...blank.steps[0], questions: state.definition.steps[0].questions }, ...blank.steps.slice(1)];
  else steps = state.definition.steps.slice(0, 1);

  if (type === 'journey') steps = steps.map((step, i) => (step.title ? step : { ...step, title: dayTitle(i + 1) }));
  return { ...state, type, definition: { ...blank, steps, thisOrThat, xp: state.definition.xp } };
}

/** `datetime-local` holds local wall time without a zone; this is the local reading of an instant. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDetail(detail: AdminActivityDetail): EditorState {
  return {
    type: detail.type,
    title: detail.title,
    summary: detail.summary,
    instructions: detail.instructions,
    // A version saved when a choice question measured one dimension opens in today's shape.
    definition: definitionWithDimensionScores(detail.definition),
    audience: detail.audience,
    worldIds: detail.worlds.map((world) => world.id),
    startsAt: toLocalInput(detail.startsAt),
    endsAt: toLocalInput(detail.endsAt),
  };
}

export function toInput(state: EditorState): ActivityInput {
  return {
    ...state,
    // «این یا اون» has no questions: any kept from the type before stay in the builder, never checked or sent.
    definition: state.type === 'this_or_that' ? { ...state.definition, steps: [] } : state.definition,
    startsAt: state.startsAt ? new Date(state.startsAt).toISOString() : null,
    endsAt: state.endsAt ? new Date(state.endsAt).toISOString() : null,
  };
}

/**
 * The builder's steps, in order: seven for every type — «این یا اون» has
 * its cards where the others have questions — and an eighth a journey adds
 * before the last.
 */
export const EDITOR_STEPS = [
  { id: 'type', label: 'نوع' },
  { id: 'details', label: 'اطلاعات' },
  { id: 'questions', label: 'سؤال‌ها', except: 'this_or_that' },
  { id: 'cards', label: 'کارت‌ها', only: 'this_or_that' },
  { id: 'audience', label: 'مخاطبان' },
  { id: 'xp', label: 'XP' },
  { id: 'schedule', label: 'زمان‌بندی' },
  { id: 'sharing', label: 'نتایج و اشتراک‌گذاری', only: 'journey' },
  { id: 'preview', label: 'پیش‌نمایش و انتشار' },
] as const;

export type EditorStepId = (typeof EDITOR_STEPS)[number]['id'];

/** The steps an activity of this type walks through. */
export const stepsFor = (type: ActivityType) =>
  EDITOR_STEPS.filter((step) => ('only' in step ? step.only === type : !('except' in step) || step.except !== type));

/** The step whose fields an error path belongs to, so a failed save can open it. */
export function stepOfPath(path: string): EditorStepId {
  if (path.startsWith('type')) return 'type';
  if (path.startsWith('definition.journey.rewards')) return 'xp';
  if (path.startsWith('definition.journey.questionsPerDay')) return 'details';
  if (path.startsWith('definition.journey.motions')) return 'questions';
  if (path.startsWith('definition.journey.dayEnd') || path.startsWith('definition.journey.result')) return 'sharing';
  if (path.startsWith('definition.journey')) return 'schedule';
  if (path.startsWith('definition.thisOrThat')) return 'cards';
  if (path.startsWith('audience')) return 'audience';
  if (path.startsWith('startsAt') || path.startsWith('endsAt')) return 'schedule';
  if (path.startsWith('definition.xp')) return 'xp';
  if (path.startsWith('definition.steps') || path.startsWith('definition.assessment')) return 'questions';
  return 'details';
}
