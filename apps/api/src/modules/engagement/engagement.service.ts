import { ENGAGEMENT_LIMITS, LEADERBOARD_SIZE } from '@hamdastan/config';
import {
  ENGAGEMENT_ERROR_CODES as CODES,
  type ActivityAnswers,
  type ActivityAudience,
  type ActivityCard,
  type ActivityExport,
  type ActivityQuestion,
  type ActivityResults,
  type ActivityStatus,
  type ActivityStatusAction,
  type ActivitySubmission,
  type AdminActivityDetail,
  type AdminActivityEvent,
  type AdminActivitySummary,
  type AdminSubmission,
  type AdminXpGrant,
  type JourneyAnswerInput,
  type JourneyAnswerOutcome,
  type JourneyPreview,
  type AdminLeaderboardEntry,
  type Leaderboard,
  type LeaderboardEntry,
  type Paginated,
  type ParticipationStatus,
  type PlayerActivity,
  type PlayerJourney,
  type PlayerQuestion,
  type ReviewStatus,
  type WorldHomeCandidate,
} from '@hamdastan/types';
import { MOTION_DURATION } from '@hamdastan/config';
import {
  journeyDayEndDefaults,
  journeyResultDefaults,
  motionOff,
  pickCharacter,
  thisOrThatAnswers,
  thisOrThatWinners,
  traitScores,
  validateAnswers,
  type ActivityInputOutput,
} from '@hamdastan/validation';

import { AppError, NotFoundError, ValidationError } from '../../shared/errors';
import { requestHash, type StoredIdempotency } from '../../shared/idempotency';
import type { AdminRecord } from '../admin';
import { mediaService } from '../media';
import { notificationsService, uniqueKey } from '../notifications';
import { progressService } from '../progress';
import type { UserRecord } from '../users';

import { engagementRepository } from './engagement.repository';
import { isAnswerable, isReadable, journeyDays, nextUnlockAt, type JourneyDayState } from './engagement.journey';
import { mediaRefs } from './engagement.media';
import { assessmentStats, describeAnswer, questionStats, thisOrThatStats, toCsv } from './engagement.results';
import { earnsXp, mayRevealAnswers, reviewAnswers, scoreAssessment } from './engagement.scoring';
import { cardOrder } from './engagement.this-or-that';
import type {
  ActivityFields,
  ActivityListQuery,
  ActivityRecord,
  AdminActivityRecord,
  JourneyProgressRecord,
  JourneyResultRecord,
  ResponseFilter,
  StoredActivityStatus,
  SubmissionOutcome,
  UserActivityRecord,
  LeaderboardRow,
} from './engagement.types';

/**
 * Business logic for Engagement Studio — one engine for surveys, missions
 * and assessments.
 *
 * Everything that decides is here: who may see and submit an activity,
 * whether a submission completes or waits for an admin, what it scores, and
 * whether it earns XP. The client sends answers and nothing else; the reward
 * is worked out from the stored version and written to the ledger in the
 * same transaction as the response.
 *
 * Editing a published activity, or one somebody has started, writes a new
 * version rather than changing the one already answered, so a response and
 * the reward it earned always point at the questions and the XP amount that
 * were live at the time.
 */

const notFound = () => new NotFoundError('فعالیت پیدا نشد');


const iso = (date: Date | null) => date?.toISOString() ?? null;

/** `scheduled` and a published activity past its end are read off the clock. */
function effectiveStatus(activity: ActivityRecord, now: Date): ActivityStatus {
  if (activity.status !== 'published') return activity.status;
  if (activity.startsAt && activity.startsAt > now) return 'scheduled';
  if (activity.endsAt && activity.endsAt <= now) return 'closed';
  return 'published';
}

const isOpen = (activity: ActivityRecord, now: Date) => effectiveStatus(activity, now) === 'published';

function toSummary(record: AdminActivityRecord, now: Date): AdminActivitySummary {
  const { xp } = record.definition;
  return {
    id: record.id,
    type: record.type,
    status: effectiveStatus(record, now),
    title: record.title,
    audience: record.audience,
    xpAmount: xp.enabled ? xp.amount : null,
    version: record.version,
    startsAt: iso(record.startsAt),
    endsAt: iso(record.endsAt),
    publishedAt: iso(record.publishedAt),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    stats: record.stats,
    worlds: record.worlds,
  };
}

function toDetail(record: AdminActivityRecord, now: Date): AdminActivityDetail {
  return {
    ...toSummary(record, now),
    summary: record.summary,
    instructions: record.instructions,
    versionId: record.versionId,
    definition: record.definition,
  };
}

function toFields(input: ActivityInputOutput): ActivityFields {
  return {
    ...input,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
  };
}

/** A question as the product receives it: the answer key and the scoring stay on the server. */
function toPlayerQuestion(question: ActivityQuestion): PlayerQuestion {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dimensionId, reverse, weight, ...rest } = question;
  if (rest.kind === 'single' || rest.kind === 'multiple') {
    // The explanation is part of the answer key: it is sent only once answers may be revealed.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { explanation, ...choice } = rest;
    return { ...choice, options: choice.options.map(({ id, label, imageId }) => ({ id, label, imageId })) };
  }
  if (rest.kind === 'matching') {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { explanation, pairs, ...matching } = rest;
    return {
      ...matching,
      prompts: pairs.map((pair) => ({ id: pair.id, label: pair.prompt })),
      // Ordered by their own random ids: stable across reads, and unrelated to the prompts' order.
      matches: pairs
        .map((pair) => ({ id: pair.matchId, label: pair.match }))
        .sort((a, b) => (a.id < b.id ? -1 : 1)),
    };
  }
  return rest;
}

const playerQuestions = (activity: ActivityRecord) =>
  activity.definition.steps.flatMap((step) => step.questions.map(toPlayerQuestion));

/** «این یا اون»: the cards in the order this person meets them — the same on every read of this version. */
const duelOrder = (activity: ActivityRecord, userId: string) =>
  activity.definition.thisOrThat ? cardOrder(activity.definition.thisOrThat, `${activity.versionId}:${userId}`) : [];

/**
 * «این یا اون»'s answers checked against the person's order: a run of
 * matches from the first card. A submission must have played them all.
 */
function checkDuel(
  activity: ActivityRecord,
  userId: string,
  answers: ActivityAnswers,
  complete: boolean
): { ok: true; answers: ActivityAnswers } | { ok: false; errors: Record<string, string> } {
  const ids = duelOrder(activity, userId).map((card) => card.id);
  const winners = thisOrThatWinners(ids, answers);
  if (!winners) return { ok: false, errors: { thisOrThat: 'این انتخاب‌ها با کارت‌های این فعالیت جور نیست' } };
  if (complete && winners.length !== ids.length - 1) {
    return { ok: false, errors: { thisOrThat: 'همه‌ی رقابت‌ها رو تا آخر انجام بده' } };
  }
  return { ok: true, answers: thisOrThatAnswers(ids, winners) };
}

function participationStatus(entry: UserActivityRecord): ParticipationStatus {
  return entry.participation?.status ?? 'not_started';
}

/** Whether the person may start, continue or submit again — the API's word, not the screen's. */
function canSubmit(entry: UserActivityRecord, now: Date): boolean {
  const { activity, participation } = entry;
  if (activity.type === 'journey') {
    return entry.eligible && isOpen(activity, now) && !participation?.completedAt;
  }
  return (
    entry.eligible &&
    isOpen(activity, now) &&
    participation?.status !== 'pending_review' &&
    (participation?.submissions ?? 0) < activity.definition.maxSubmissions
  );
}

/** Everything an activity can pay one person: for a journey, every answer, every day and the finish. */
function totalXp(definition: ActivityRecord['definition']): number {
  const { xp, journey, steps } = definition;
  if (!xp.enabled) return 0;
  if (!journey) return xp.amount;
  const questions = steps.reduce((sum, step) => sum + step.questions.length, 0);
  return xp.amount + journey.rewards.perQuestion * questions + journey.rewards.perDay * steps.length;
}

function toCard(entry: UserActivityRecord, now: Date): ActivityCard {
  const { activity } = entry;
  const { xp, estimatedMinutes } = activity.definition;
  const reward = totalXp(activity.definition);
  return {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    summary: activity.summary,
    estimatedMinutes,
    xp: xp.showBeforeStart && reward > 0 ? reward : null,
    status: participationStatus(entry),
    endsAt: iso(activity.endsAt),
    canSubmit: canSubmit(entry, now),
    worlds: activity.worlds,
  };
}

/**
 * Whether the person may see it at all: open and meant for them, or one they
 * already took part in. Anything else is a 404 — an activity meant for
 * somebody else is not admitted to exist.
 */
function visibleTo(entry: UserActivityRecord | null, now: Date): entry is UserActivityRecord {
  if (!entry || entry.activity.status === 'draft' || entry.activity.status === 'archived') return false;
  return entry.participation !== null || (entry.eligible && isOpen(entry.activity, now));
}

// ─── Journey ─────────────────────────────────────────────────────────────────

const journeyOnly = () =>
  new AppError(409, CODES.JOURNEY_ANSWER_ONLY, 'چالش چندروزه سؤال‌به‌سؤال جواب داده می‌شه');

/** A journey's settings and start; the schema refuses a journey without either. */
function journeyOf(activity: ActivityRecord) {
  const settings = activity.definition.journey;
  if (!settings || !activity.startsAt) throw new AppError(500, 'JOURNEY_MISCONFIGURED', 'تنظیمات این چالش ناقصه');
  return { settings, campaignStart: activity.startsAt };
}

/** A journey's motions; one saved before motions existed has none set. */
const journeyMotions = (settings: NonNullable<ActivityRecord['definition']['journey']>) =>
  settings.motions ?? {
    answer: motionOff(MOTION_DURATION.ANSWER_MS),
    dayComplete: motionOff(MOTION_DURATION.DAY_COMPLETE_MS),
    journeyComplete: motionOff(MOTION_DURATION.JOURNEY_COMPLETE_MS),
  };

/**
 * Every library file the definition names must exist, and an image's place
 * must hold an image. A problem lands under the field that names the file.
 */
async function checkMedia(input: ActivityInputOutput): Promise<void> {
  const refs = mediaRefs(input.definition);
  if (refs.length === 0) return;
  const kinds = await mediaService.kinds(refs.map((ref) => ref.id));
  const fields: Record<string, string> = {};
  for (const ref of refs) {
    const kind = kinds.get(ref.id);
    if (!kind) fields[ref.path] ??= 'این فایل در کتابخانه وجود ندارد؛ دوباره انتخابش کنید';
    else if (ref.needs && kind !== ref.needs) fields[ref.path] ??= 'در این بخش فقط تصویر قابل استفاده است';
  }
  if (Object.keys(fields).length > 0) throw new ValidationError(Object.values(fields)[0], { fields });
}

/** The clock's view of one person's journey, now. */
function journeyClock(activity: ActivityRecord, progress: JourneyProgressRecord, now: Date): JourneyDayState[] {
  const { settings, campaignStart } = journeyOf(activity);
  return journeyDays({
    settings,
    days: activity.definition.steps,
    progress: new Map(
      activity.definition.steps.map((step) => [
        step.id,
        {
          answeredCount: step.questions.filter((q) => q.id in progress.answers).length,
          completedAt: progress.completedDays.get(step.id) ?? null,
        },
      ])
    ),
    campaignStart,
    now,
  });
}

/**
 * The journey as the person sees it. A day they may not open is a number,
 * a status and an opening time — no title, no questions, no answers.
 */
/** A journey's results settings; one saved before results existed has them off. */
const resultSettings = (activity: ActivityRecord) => activity.definition.journey?.result ?? journeyResultDefaults();

/**
 * The person's result: the one kept, or — for a finished journey with
 * results on and none kept yet — worked out from their answers now and
 * kept. Once kept it never changes.
 */
async function ensureResult(
  activity: ActivityRecord,
  userId: string,
  progress: JourneyProgressRecord
): Promise<JourneyResultRecord | null> {
  const settings = resultSettings(activity);
  if (!settings.enabled) return null;
  const kept = await engagementRepository().findJourneyResult(activity.id, userId);
  if (kept) return kept;

  const scores = traitScores(activity.definition, progress.answers);
  const character = pickCharacter(settings, scores);
  if (!character) return null;
  return engagementRepository().saveJourneyResult(activity.id, userId, activity.versionId, {
    character: {
      id: character.id,
      name: character.name,
      title: character.title,
      description: character.description,
      imageId: character.imageId,
    },
    traits: settings.traits.map((trait) => ({ id: trait.id, title: trait.title, score: scores.get(trait.id) ?? 0 })),
  });
}

/** The library files a kept result shows: its character's picture and the card's logo. */
function resultMedia(result: JourneyResultRecord | null, activity: ActivityRecord) {
  const ids = [result?.character.imageId, result ? resultSettings(activity).card.logoId : null];
  return mediaService.describe(ids.filter((id): id is string => Boolean(id)));
}

function toPlayerJourney(
  entry: UserActivityRecord,
  progress: JourneyProgressRecord,
  states: JourneyDayState[],
  now: Date,
  result: JourneyResultRecord | null = null
): PlayerJourney {
  const { definition } = entry.activity;
  const { settings } = journeyOf(entry.activity);
  const answers: PlayerJourney['answers'] = {};

  const days = definition.steps.map((step, index) => {
    const state = states[index];
    const readable = isReadable(state, settings);
    if (readable) {
      for (const question of step.questions) {
        if (question.id in progress.answers) answers[question.id] = progress.answers[question.id];
      }
    }
    return {
      id: step.id,
      number: state.number,
      title: readable || state.status === 'completed' ? step.title : null,
      status: state.status,
      lockReason: state.lockReason,
      unlocksAt: iso(state.unlocksAt),
      closesAt: iso(state.closesAt),
      questionCount: step.questions.length,
      answeredCount: step.questions.filter((q) => q.id in progress.answers).length,
      completedAt: iso(progress.completedDays.get(step.id) ?? null),
      xpEarned: [...step.questions.map((q) => `${entry.activity.id}:q:${q.id}`), `${entry.activity.id}:d:${step.id}`].reduce(
        (sum, sourceId) => sum + (progress.xp.get(sourceId) ?? 0),
        0
      ),
    };
  });

  return {
    days,
    completedDays: states.filter((state) => state.status === 'completed').length,
    nextUnlockAt: iso(nextUnlockAt(states, now)),
    answers,
    rewards: definition.xp.enabled ? { ...settings.rewards, completion: definition.xp.amount } : null,
    completedAt: iso(entry.participation?.completedAt ?? null),
    motions: journeyMotions(settings),
    // A journey saved before the day-end page existed gets the default one.
    dayEnd: settings.dayEnd ?? journeyDayEndDefaults(),
    result: result && {
      character: result.character,
      traits: result.traits,
      card: resultSettings(entry.activity).card,
      createdAt: result.createdAt.toISOString(),
    },
  };
}

/** The steps the product receives: only the days the person may open. */
function journeySteps(activity: ActivityRecord, states: JourneyDayState[]) {
  const { settings } = journeyOf(activity);
  return activity.definition.steps
    .filter((_, index) => isReadable(states[index], settings))
    .map((step) => ({ ...step, questions: step.questions.map(toPlayerQuestion) }));
}

/** Where a status action may start from, and what it leads to. */
const TRANSITIONS: Record<ActivityStatusAction, { from: StoredActivityStatus[]; to: StoredActivityStatus; audit: string }> = {
  publish: { from: ['draft'], to: 'published', audit: 'published' },
  pause: { from: ['published'], to: 'paused', audit: 'paused' },
  resume: { from: ['paused'], to: 'published', audit: 'resumed' },
  close: { from: ['published', 'paused'], to: 'closed', audit: 'closed' },
  archive: { from: ['draft', 'published', 'paused', 'closed'], to: 'archived', audit: 'archived' },
};

/** The copy's title: the original's, marked, within the limit. */
const copyTitle = (title: string) => {
  const mark = ' (کپی)';
  return `${title.slice(0, ENGAGEMENT_LIMITS.TITLE_MAX - mark.length)}${mark}`;
};

async function requireActivity(id: string): Promise<AdminActivityRecord> {
  const record = await engagementRepository().findById(id);
  if (!record) throw notFound();
  return record;
}

/** The results filter: an anonymous survey cannot be narrowed by who answered. */
/** A key reused for a different request: the client has a bug, not a retry. */
const keyReused = () =>
  new AppError(422, 'IDEMPOTENCY_KEY_REUSED', 'این درخواست قبلاً با محتوای دیگری فرستاده شده');

function assertSameRequest(stored: StoredIdempotency<SubmissionOutcome>): SubmissionOutcome {
  if (stored.state === 'mismatch') throw keyReused();
  return stored.outcome;
}

/**
 * The answer to a submission — the first time, and identically on every
 * retry of it. The XP total is read fresh: it is the one figure that may
 * rightly have moved since.
 */
async function answerSubmission(user: UserRecord, outcome: SubmissionOutcome): Promise<ActivitySubmission> {
  if (outcome.status === 'pending_review') {
    throw new AppError(409, CODES.ACTIVITY_PENDING_REVIEW, 'پاسخ قبلیت هنوز در انتظار تأییده');
  }
  if (outcome.status !== 'submitted') {
    throw new AppError(409, CODES.ACTIVITY_LIMIT_REACHED, 'به سقف دفعات مجازِ این فعالیت رسیدی');
  }
  return {
    status: outcome.completes ? 'completed' : 'pending_review',
    xpAwarded: outcome.xpAwarded,
    xpTotal: await progressService.total(user.id),
    result: outcome.result,
    // Added by `submit` on the first answer; a retry finds them on the activity's page.
    answerReview: null,
    rank: null,
  };
}

const toEntry = (row: LeaderboardRow, userId: string | null): LeaderboardEntry => ({
  rank: row.rank,
  name: row.name,
  score: row.score,
  durationMs: row.durationMs,
  me: row.userId === userId,
});

const notCompetition = () => new NotFoundError('جدول امتیازات پیدا نشد');

const ADMIN_LEADERBOARD_SIZE = 100;

function responseFilter(record: AdminActivityRecord, query: { from?: string; to?: string; categoryId?: string }): ResponseFilter {
  return {
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    categoryId: record.definition.anonymous ? undefined : query.categoryId,
  };
}

export const engagementService = {
  // ─── Admin: designing and publishing ───────────────────────────────────

  async list(query: ActivityListQuery): Promise<Paginated<AdminActivitySummary>> {
    const now = new Date();
    const { items, total } = await engagementRepository().list(query);
    return { items: items.map((item) => toSummary(item, now)), page: query.page, pageSize: query.pageSize, total };
  },

  async get(id: string): Promise<AdminActivityDetail> {
    return toDetail(await requireActivity(id), new Date());
  },

  async create(actor: AdminRecord, input: ActivityInputOutput): Promise<AdminActivityDetail> {
    await checkMedia(input);
    const id = await engagementRepository().create(toFields(input), actor.id);
    return this.get(id);
  },

  async update(actor: AdminRecord, id: string, input: ActivityInputOutput): Promise<AdminActivityDetail> {
    const current = await requireActivity(id);
    if (current.status === 'archived') {
      throw new AppError(409, CODES.ACTIVITY_ARCHIVED, 'فعالیت بایگانی‌شده قابل ویرایش نیست');
    }
    if (current.status !== 'draft' && input.type !== current.type) {
      throw new ValidationError('نوع فعالیتِ منتشرشده قابل تغییر نیست', { fields: { type: 'نوع فعالیتِ منتشرشده قابل تغییر نیست' } });
    }

    await checkMedia(input);

    // What has been published or answered is history: an edit becomes the next version.
    const newVersion = current.status !== 'draft' || current.stats.started > 0 || current.stats.responses > 0;
    await engagementRepository().update(id, toFields(input), actor.id, newVersion);
    return this.get(id);
  },

  async changeStatus(actor: AdminRecord, id: string, action: ActivityStatusAction): Promise<AdminActivityDetail> {
    const current = await requireActivity(id);
    if (action === 'publish' && current.endsAt && current.endsAt <= new Date()) {
      throw new ValidationError('تاریخ پایان این فعالیت گذشته است؛ ابتدا زمان‌بندی را اصلاح کنید', {
        fields: { endsAt: 'زمان پایان باید در آینده باشد' },
      });
    }

    const { from, to, audit } = TRANSITIONS[action];
    if (!(await engagementRepository().setStatus(id, to, from, actor.id, audit))) {
      throw new AppError(409, CODES.ACTIVITY_INVALID_TRANSITION, 'این کار در وضعیت فعلیِ فعالیت ممکن نیست');
    }
    return this.get(id);
  },

  async duplicate(actor: AdminRecord, id: string): Promise<AdminActivityDetail> {
    const source = await requireActivity(id);
    const copyId = await engagementRepository().duplicate(id, copyTitle(source.title), actor.id);
    return this.get(copyId);
  },

  /** Only an activity that never paid XP; otherwise archive it. */
  async remove(actor: AdminRecord, id: string): Promise<{ deleted: true }> {
    const outcome = await engagementRepository().remove(id, actor.id);
    if (outcome === 'not_found') throw notFound();
    if (outcome === 'has_xp') {
      throw new AppError(409, CODES.ACTIVITY_HAS_XP, 'این فعالیت XP پرداخت کرده است؛ به‌جای حذف، آن را بایگانی کنید');
    }
    return { deleted: true };
  },

  async previewAudience(audience: ActivityAudience): Promise<{ eligible: number }> {
    return { eligible: await engagementRepository().countAudience(audience) };
  },

  async history(id: string): Promise<AdminActivityEvent[]> {
    await requireActivity(id);
    const rows = await engagementRepository().listHistory(id);
    return rows.map((row) => ({
      id: row.id,
      action: row.action as AdminActivityEvent['action'],
      adminName: row.adminName,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    }));
  },

  /**
   * A journey as a person would play it, for the admin's full preview: the
   * current version, every day open and unanswered, each with the time it
   * would open. Built here, from the same pieces as the real player, and
   * never written anywhere.
   */
  async preview(id: string): Promise<JourneyPreview> {
    const record = await requireActivity(id);
    if (record.type !== 'journey' || !record.definition.journey) throw notFound();
    const now = new Date();
    const definition = record.definition;
    const settings = definition.journey!;
    const start = record.startsAt ?? now;
    const empty: JourneyProgressRecord = { answers: {}, completedDays: new Map(), xp: new Map() };
    const scheduled = journeyDays({ settings, days: definition.steps, progress: new Map(), campaignStart: start, now: start });
    const states: JourneyDayState[] = scheduled.map((state) => ({ ...state, status: 'available', lockReason: null }));

    const entry: UserActivityRecord = { activity: record, eligible: true, participation: null, lastResult: null, lastAnswers: null };
    const journey = toPlayerJourney(entry, empty, states, now);
    const media = await mediaService.describe(mediaRefs(definition).map((ref) => ref.id));

    return {
      definition,
      activity: {
        ...toCard(entry, now),
        canSubmit: true,
        instructions: record.instructions,
        versionId: record.versionId,
        steps: definition.steps.map((step) => ({ ...step, questions: step.questions.map(toPlayerQuestion) })),
        anonymous: false,
        review: 'auto',
        submissions: 0,
        maxSubmissions: 1,
        draft: null,
        lastResult: null,
        answerReview: null,
        journey,
        thisOrThat: null,
        media,
      },
    };
  },

  // ─── Admin: results ────────────────────────────────────────────────────

  async results(id: string, query: { from?: string; to?: string; categoryId?: string }): Promise<ActivityResults> {
    const record = await requireActivity(id);
    const filter = responseFilter(record, query);
    const responses = await engagementRepository().listResponses(id, filter);

    return {
      activity: toSummary(record, new Date()),
      anonymous: record.definition.anonymous,
      filtered: Boolean(filter.from || filter.to || filter.categoryId),
      responses: responses.length,
      questions: questionStats(record.definition, responses),
      assessment: assessmentStats(record.definition, responses),
      thisOrThat: thisOrThatStats(record.definition, responses),
    };
  },

  /**
   * One row per response. For an anonymous survey nothing that identifies
   * anyone is printed — and none is stored to print.
   */
  async exportCsv(id: string, query: { from?: string; to?: string; categoryId?: string }): Promise<ActivityExport> {
    const record = await requireActivity(id);
    const responses = await engagementRepository().listResponses(id, responseFilter(record, query));
    const stamp = new Date().toISOString().slice(0, 10);
    return {
      filename: `activity-${record.id.slice(0, 8)}-${stamp}.csv`,
      csv: toCsv(record.definition, responses, !record.definition.anonymous),
    };
  },

  async submissions(
    id: string,
    query: { status?: ReviewStatus; page: number; pageSize: number }
  ): Promise<Paginated<AdminSubmission>> {
    await requireActivity(id);
    const { items, total } = await engagementRepository().listSubmissions(id, query);
    return {
      items: items.map((row) => ({
        id: row.id,
        user: row.user,
        submittedAt: row.submittedAt.toISOString(),
        reviewStatus: row.reviewStatus,
        reviewNote: row.reviewNote,
        reviewedAt: iso(row.reviewedAt),
        answers: row.definition.steps.flatMap((step) =>
          step.questions.map((question) => ({
            questionId: question.id,
            title: question.title,
            value: describeAnswer(question, row.answers[question.id]),
          }))
        ),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },

  /**
   * Approving a mission is what completes it and, only now, pays its
   * reward — at most once per allowed award, however many admins click.
   */
  async review(
    actor: AdminRecord,
    responseId: string,
    decision: 'approve' | 'reject',
    note: string | undefined
  ): Promise<{ xpAwarded: number }> {
    const target = await engagementRepository().findReviewTarget(responseId);
    if (!target) throw new NotFoundError('پاسخ یافت نشد');

    const { xp } = target.definition;
    const outcome = await engagementRepository().review({
      responseId,
      decision,
      note: note || null,
      adminId: actor.id,
      reward:
        decision === 'approve' && earnsXp(target.definition, null)
          ? { xp: xp.amount, maxAwards: xp.maxAwards, reason: `تأیید مأموریت «${target.activityTitle}»` }
          : null,
    });

    if (outcome.status === 'reviewed') {
      if (target.userId) {
        await notificationsService.submissionReviewed(target.userId, {
          responseId,
          activityId: target.activityId,
          activityTitle: target.activityTitle,
          approved: decision === 'approve',
          xp: outcome.xpAwarded,
        });
      }
      return { xpAwarded: outcome.xpAwarded };
    }
    if (outcome.status === 'not_found') throw new NotFoundError('پاسخ یافت نشد');
    throw new AppError(409, CODES.SUBMISSION_ALREADY_REVIEWED, 'این پاسخ قبلاً بررسی شده است');
  },

  async grants(id: string, query: { page: number; pageSize: number }): Promise<Paginated<AdminXpGrant>> {
    await requireActivity(id);
    const { items, total } = await engagementRepository().listGrants(id, query);
    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        revokedAt: iso(row.revokedAt),
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  },

  /** Takes a grant back with a reason, by appending its reversal. Nothing is deleted. */
  async revokeXp(actor: AdminRecord, transactionId: string, reason: string): Promise<{ revoked: true }> {
    const outcome = await progressService.revoke(transactionId, reason, actor.id);
    switch (outcome.status) {
      case 'not_found':
        throw new NotFoundError('تراکنش یافت نشد');
      case 'not_revocable':
        throw new ValidationError('این تراکنش خود یک ابطال است');
      case 'already_revoked':
        throw new AppError(409, CODES.XP_ALREADY_REVOKED, 'این امتیاز قبلاً باطل شده است');
      case 'revoked':
        await engagementRepository().audit(outcome.activityId, actor.id, 'xp_revoked', {
          transactionId,
          amount: outcome.amount,
          reason,
        });
        return { revoked: true };
    }
  },

  // ─── For a world's home ────────────────────────────────────────────────

  /**
   * Open activities filed under the world that the person may take part in:
   * the featured ones in their order, else the newest. With no person (an
   * admin's preview), every open one.
   */
  async worldCards(userId: string | null, worldId: string, options: { ids?: string[]; limit: number }): Promise<ActivityCard[]> {
    const now = new Date();
    const entries = await engagementRepository().listOpenForWorld(worldId, userId, { ids: options.ids, limit: options.ids?.length ?? options.limit, now });
    const byId = new Map(entries.map((entry) => [entry.activity.id, entry]));
    const ordered = options.ids ? options.ids.flatMap((id) => byId.get(id) ?? []) : entries;
    return ordered.slice(0, options.limit).map((entry) => toCard(entry, now));
  },

  /** What the panel may feature: activities filed under the world, in any status. */
  async worldItems(worldId: string, options: { ids?: string[]; q?: string }): Promise<WorldHomeCandidate[]> {
    const now = new Date();
    const records = await engagementRepository().listForWorld(worldId, { ...options, limit: options.ids?.length ?? 30 });
    const byId = new Map(records.map((record) => [record.id, record]));
    const ordered = options.ids ? options.ids.flatMap((id) => byId.get(id) ?? []) : records;
    return ordered.map((record) => {
      const status = effectiveStatus(record, now);
      // In the content index's words: a closed activity has ended.
      return { id: record.id, title: record.title, status: status === 'closed' ? 'ended' : status, live: status === 'published' };
    });
  },

  // ─── For a place ───────────────────────────────────────────────────────

  /** A place's tasks as this person sees them: the ones they may see, in the order of `ids`. */
  async cardsFor(userId: string, ids: string[]): Promise<ActivityCard[]> {
    const now = new Date();
    const entries = await engagementRepository().findManyForUser(ids, userId);
    const byId = new Map(entries.map((entry) => [entry.activity.id, entry]));
    return ids.flatMap((id) => {
      const entry = byId.get(id) ?? null;
      return visibleTo(entry, now) ? [toCard(entry, now)] : [];
    });
  },

  // ─── Product ───────────────────────────────────────────────────────────

  async listMine(user: UserRecord): Promise<ActivityCard[]> {
    const now = new Date();
    const entries = await engagementRepository().listForUser(user.id, now);
    return entries.map((entry) => toCard(entry, now));
  },

  async getMine(user: UserRecord, id: string): Promise<PlayerActivity> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now)) throw notFound();

    const { activity, participation } = entry;
    let steps = activity.definition.steps.map((step) => ({ ...step, questions: step.questions.map(toPlayerQuestion) }));
    let journey: PlayerJourney | null = null;
    if (activity.type === 'journey') {
      const progress = await engagementRepository().findJourneyProgress(id, user.id);
      const states = journeyClock(activity, progress, now);
      steps = journeySteps(activity, states);
      const result = participation?.completedAt ? await ensureResult(activity, user.id, progress) : null;
      journey = toPlayerJourney(entry, progress, states, now, result);
    }
    // Only the files the sent days (and the journey's own motions) refer to — and the person's own result's.
    const sent = new Set(steps.map((step) => step.id));
    const refs = mediaRefs(activity.definition, activity.definition.steps.filter((step) => sent.has(step.id)), false);
    const resultIds = [journey?.result?.character.imageId, journey?.result?.card.logoId].filter((x): x is string => Boolean(x));

    return {
      ...toCard(entry, now),
      instructions: activity.instructions,
      versionId: activity.versionId,
      steps,
      anonymous: activity.definition.anonymous,
      review: activity.definition.review,
      submissions: participation?.submissions ?? 0,
      maxSubmissions: activity.definition.maxSubmissions,
      draft: participation?.draft ?? null,
      lastResult: activity.definition.assessment?.showResult ? entry.lastResult : null,
      answerReview:
        entry.lastAnswers && mayRevealAnswers(activity, participation?.submissions ?? 0, now)
          ? reviewAnswers(activity.definition, entry.lastAnswers)
          : null,
      journey,
      thisOrThat: activity.definition.thisOrThat
        ? { coverImageId: activity.definition.thisOrThat.coverImageId, cards: duelOrder(activity, user.id) }
        : null,
      media: await mediaService.describe([...refs.map((ref) => ref.id), ...resultIds]),
    };
  },

  async saveDraft(user: UserRecord, id: string, answers: ActivityAnswers): Promise<{ saved: true }> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now)) throw notFound();
    if (entry.activity.type === 'journey') throw journeyOnly();
    if (!canSubmit(entry, now)) {
      throw new AppError(409, CODES.ACTIVITY_CLOSED, 'این فعالیت الان پاسخ نمی‌پذیره');
    }

    if (entry.activity.type === 'this_or_that') {
      // The matches played so far — a run from the first card, or nothing is kept.
      const checked = checkDuel(entry.activity, user.id, answers, false);
      if (!checked.ok) throw new ValidationError(Object.values(checked.errors)[0], { fields: checked.errors });
      await engagementRepository().saveDraft(id, user.id, checked.answers);
      return { saved: true };
    }

    // Only ids that are questions are kept; a draft is otherwise half-done by design.
    const known = new Set(playerQuestions(entry.activity).map((question) => question.id));
    const kept = Object.fromEntries(Object.entries(answers).filter(([questionId]) => known.has(questionId)));
    await engagementRepository().saveDraft(id, user.id, kept);
    return { saved: true };
  },

  async submit(
    user: UserRecord,
    id: string,
    input: { versionId: string; answers: ActivityAnswers },
    idempotencyKey?: string
  ): Promise<ActivitySubmission> {
    const idempotency = idempotencyKey
      ? {
          scope: 'engagement.submit',
          ownerId: user.id,
          key: idempotencyKey,
          requestHash: requestHash({ activityId: id, ...input }),
        }
      : null;

    // A retry of a submission that already went through is answered from
    // its record before anything else is checked — the activity may have
    // closed since, and the person must still learn that it counted.
    if (idempotency) {
      const stored = await engagementRepository().findSubmission(idempotency);
      if (stored) return answerSubmission(user, assertSameRequest(stored));
    }

    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now) || !entry.eligible) throw notFound();

    const { activity } = entry;
    if (activity.type === 'journey') throw journeyOnly();
    if (!isOpen(activity, now)) {
      throw new AppError(409, CODES.ACTIVITY_CLOSED, 'مهلت این فعالیت تموم شده یا متوقف شده');
    }
    if (input.versionId !== activity.versionId) {
      throw new AppError(409, CODES.ACTIVITY_VERSION_CHANGED, 'این فعالیت به‌روز شده؛ صفحه رو دوباره باز کن');
    }

    const checked =
      activity.type === 'this_or_that'
        ? checkDuel(activity, user.id, input.answers, true)
        : validateAnswers(playerQuestions(activity), input.answers);
    if (!checked.ok) {
      throw new ValidationError(Object.values(checked.errors)[0], { fields: checked.errors });
    }

    const { definition } = activity;
    const result = scoreAssessment(definition, checked.answers, user.gender);
    const completes = definition.review === 'auto';

    const outcome = await engagementRepository().submit({
      activityId: activity.id,
      versionId: activity.versionId,
      userId: user.id,
      anonymous: definition.anonymous,
      answers: checked.answers,
      result,
      // What the person is shown — the response above keeps the full result.
      visibleResult: definition.assessment?.showResult ? result : null,
      score: result?.score ?? null,
      passed: result?.passed ?? null,
      maxSubmissions: definition.maxSubmissions,
      completes,
      // A reviewed mission is paid on approval, not here.
      reward:
        completes && earnsXp(definition, result)
          ? { xp: definition.xp.amount, maxAwards: definition.xp.maxAwards, reason: `«${activity.title}»` }
          : null,
      idempotency,
    });

    if (outcome.status === 'key_mismatch') throw keyReused();
    // Only this, the first answer to the write, notifies; a retry is answered from its record above.
    if (outcome.status === 'submitted') {
      await notificationsService.xpEarned(user.id, {
        xp: outcome.xpAwarded,
        reason: `برای «${activity.title}»`,
        dedupeKey: uniqueKey(`submit:${activity.id}`, idempotencyKey),
        destination: { kind: 'activity', activityId: activity.id },
      });
    }
    const answer = await answerSubmission(user, outcome);
    if (outcome.status !== 'submitted') return answer;
    const submissions = (entry.participation?.submissions ?? 0) + 1;
    return {
      ...answer,
      answerReview: mayRevealAnswers(activity, submissions, now) ? reviewAnswers(definition, checked.answers) : null,
      rank:
        activity.type === 'competition'
          ? (await engagementRepository().leaderboard(activity.id, 0, user.id)).rows.map((row) => toEntry(row, user.id))[0] ?? null
          : null,
    };
  },

  /** The person starts: the clock a competition ranks by runs from here. Starting again changes nothing. */
  async start(user: UserRecord, id: string): Promise<{ started: true }> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now) || !entry.eligible) throw notFound();
    if (!canSubmit(entry, now)) throw new AppError(409, CODES.ACTIVITY_CLOSED, 'این فعالیت الان پاسخ نمی‌پذیره');
    await engagementRepository().markStarted(id, user.id);
    return { started: true };
  },

  /** A competition's ranking for the panel: the first hundred, with full names. */
  async adminLeaderboard(id: string): Promise<AdminLeaderboardEntry[]> {
    const record = await requireActivity(id);
    if (record.type !== 'competition') throw notCompetition();
    const { rows } = await engagementRepository().leaderboard(id, ADMIN_LEADERBOARD_SIZE, null);
    return rows.map(({ userId, rank, name, fullName, score, durationMs }) => ({ userId, rank, name, fullName, score, durationMs }));
  },

  /** A competition's leaderboard, for anyone who may see the competition — with their own place. */
  async leaderboard(user: UserRecord, id: string): Promise<Leaderboard> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now) || entry.activity.type !== 'competition') throw notCompetition();
    const { rows, total } = await engagementRepository().leaderboard(id, LEADERBOARD_SIZE, user.id);
    const entries = rows.map((row) => toEntry(row, user.id));
    return {
      entries: entries.filter((row) => row.rank <= LEADERBOARD_SIZE),
      me: entries.find((row) => row.me) ?? null,
      total,
      final: effectiveStatus(entry.activity, now) === 'closed',
    };
  },
  /**
   * One answer to a journey question. Every check is made here, on the
   * server's clock: the day must be open to this person now, the answer
   * must fit its question, and an answer already given stands — the same
   * answer again is a harmless repeat, a different one is refused. What it
   * pays is worked out from the stored version and written with it.
   */
  async answerJourney(user: UserRecord, id: string, input: JourneyAnswerInput): Promise<JourneyAnswerOutcome> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now) || !entry.eligible) throw notFound();

    const { activity } = entry;
    if (activity.type !== 'journey') throw new NotFoundError('سؤال پیدا نشد');
    if (!isOpen(activity, now)) {
      throw new AppError(409, CODES.ACTIVITY_CLOSED, 'مهلت این چالش تموم شده یا متوقف شده');
    }

    const { definition } = activity;
    const dayIndex = definition.steps.findIndex((step) => step.questions.some((q) => q.id === input.questionId));
    if (dayIndex < 0) {
      throw new AppError(409, CODES.ACTIVITY_VERSION_CHANGED, 'این چالش به‌روز شده؛ صفحه رو دوباره باز کن');
    }
    const day = definition.steps[dayIndex];

    const question = toPlayerQuestion(day.questions.find((q) => q.id === input.questionId)!);
    const checked = validateAnswers([question], input.value === null ? {} : { [question.id]: input.value });
    if (!checked.ok) {
      throw new ValidationError(Object.values(checked.errors)[0], { fields: checked.errors });
    }
    const value = checked.answers[question.id] ?? null;

    const progress = await engagementRepository().findJourneyProgress(id, user.id);
    const states = journeyClock(activity, progress, now);
    // A repeat is answered as one even once its day has closed — a retry of a day's last answer finds it finished.
    if (question.id in progress.answers) {
      return this.repeatedAnswer(user, entry, progress, progress.answers[question.id], value, now);
    }
    if (!isAnswerable(states[dayIndex])) {
      throw new AppError(409, CODES.JOURNEY_DAY_LOCKED, 'این روز الان باز نیست');
    }

    const { settings } = journeyOf(activity);
    const { xp } = definition;
    const reward = (amount: number, reason: string) => (xp.enabled && amount > 0 ? { xp: amount, reason } : null);
    const dayLabel = day.title || `روز ${dayIndex + 1}`;

    const result = await engagementRepository().answerJourney({
      activityId: activity.id,
      versionId: activity.versionId,
      userId: user.id,
      dayId: day.id,
      dayQuestionIds: day.questions.map((q) => q.id),
      questionId: question.id,
      value,
      requiredDayIds: definition.steps.filter((_, index) => states[index].status !== 'missed').map((step) => step.id),
      rewards: {
        // A skipped question finishes its day but earns nothing itself.
        question: value === null ? null : reward(settings.rewards.perQuestion, `«${activity.title}» — پاسخ`),
        day: reward(settings.rewards.perDay, `«${activity.title}» — پایان ${dayLabel}`),
        journey: earnsXp(definition, null) ? reward(xp.amount, `«${activity.title}» — پایان چالش`) : null,
      },
    });

    // The state after the write, read back rather than guessed.
    const [fresh, freshProgress] = await Promise.all([
      engagementRepository().findForUser(id, user.id),
      engagementRepository().findJourneyProgress(id, user.id),
    ]);
    const freshEntry = fresh ?? entry;
    if (result.status === 'already_answered') {
      return this.repeatedAnswer(user, freshEntry, freshProgress, result.value, value, now);
    }

    // A day's or the journey's end is worth a notification; a single answer is not.
    if (result.dayCompleted || result.journeyCompleted) {
      const { question, day: dayXp, journey } = result.xpAwarded;
      await notificationsService.xpEarned(user.id, {
        xp: question + dayXp + journey,
        reason: result.journeyCompleted ? `پایان چالش «${activity.title}»` : `پایان ${dayLabel} «${activity.title}»`,
        dedupeKey: result.journeyCompleted ? `journey:${activity.id}` : `journey-day:${activity.id}:${day.id}`,
        destination: { kind: 'activity', activityId: activity.id },
      });
    }

    // The journey's last answer decides the result, here and once.
    const kept = freshEntry.participation?.completedAt ? await ensureResult(activity, user.id, freshProgress) : null;
    return {
      status: 'recorded',
      xpAwarded: result.xpAwarded,
      dayCompleted: result.dayCompleted,
      journeyCompleted: result.journeyCompleted,
      xpTotal: await progressService.total(user.id),
      journey: toPlayerJourney(freshEntry, freshProgress, journeyClock(activity, freshProgress, now), now, kept),
      media: await resultMedia(kept, activity),
    };
  },

  /** The same answer again changes nothing and pays nothing; a different one is refused. */
  async repeatedAnswer(
    user: UserRecord,
    entry: UserActivityRecord,
    progress: JourneyProgressRecord,
    stored: ActivityAnswers[string] | null,
    sent: ActivityAnswers[string] | null,
    now: Date
  ): Promise<JourneyAnswerOutcome> {
    if (JSON.stringify(stored) !== JSON.stringify(sent)) {
      throw new AppError(409, CODES.JOURNEY_ALREADY_ANSWERED, 'به این سؤال قبلاً جواب دادی');
    }
    const kept = entry.participation?.completedAt ? await ensureResult(entry.activity, user.id, progress) : null;
    return {
      status: 'already_answered',
      xpAwarded: { question: 0, day: 0, journey: 0 },
      dayCompleted: false,
      journeyCompleted: false,
      xpTotal: await progressService.total(user.id),
      journey: toPlayerJourney(entry, progress, journeyClock(entry.activity, progress, now), now, kept),
      media: await resultMedia(kept, entry.activity),
    };
  },
};
