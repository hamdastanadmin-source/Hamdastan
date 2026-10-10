import { ENGAGEMENT_LIMITS } from '@hamdastan/config';
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
  type Paginated,
  type ParticipationStatus,
  type PlayerActivity,
  type PlayerQuestion,
  type ReviewStatus,
} from '@hamdastan/types';
import { validateAnswers, type ActivityInputOutput } from '@hamdastan/validation';

import { AppError, NotFoundError, ValidationError } from '../../shared/errors';
import type { AdminRecord } from '../admin';
import { progressService } from '../progress';
import type { UserRecord } from '../users';

import { engagementRepository } from './engagement.repository';
import { assessmentStats, describeAnswer, questionStats, toCsv } from './engagement.results';
import { earnsXp, scoreAssessment } from './engagement.scoring';
import type {
  ActivityFields,
  ActivityListQuery,
  ActivityRecord,
  AdminActivityRecord,
  ResponseFilter,
  StoredActivityStatus,
  UserActivityRecord,
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
  const { dimensionId, reverse, ...rest } = question;
  if (rest.kind === 'single' || rest.kind === 'multiple') {
    return { ...rest, options: rest.options.map(({ id, label }) => ({ id, label })) };
  }
  return rest;
}

const playerQuestions = (activity: ActivityRecord) =>
  activity.definition.steps.flatMap((step) => step.questions.map(toPlayerQuestion));

function participationStatus(entry: UserActivityRecord): ParticipationStatus {
  return entry.participation?.status ?? 'not_started';
}

/** Whether the person may start, continue or submit again — the API's word, not the screen's. */
function canSubmit(entry: UserActivityRecord, now: Date): boolean {
  const { activity, participation } = entry;
  return (
    entry.eligible &&
    isOpen(activity, now) &&
    participation?.status !== 'pending_review' &&
    (participation?.submissions ?? 0) < activity.definition.maxSubmissions
  );
}

function toCard(entry: UserActivityRecord, now: Date): ActivityCard {
  const { activity } = entry;
  const { xp, estimatedMinutes } = activity.definition;
  return {
    id: activity.id,
    type: activity.type,
    title: activity.title,
    summary: activity.summary,
    estimatedMinutes,
    xp: xp.enabled && xp.showBeforeStart && xp.amount > 0 ? xp.amount : null,
    status: participationStatus(entry),
    endsAt: iso(activity.endsAt),
    canSubmit: canSubmit(entry, now),
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
    const id = await engagementRepository().create(toFields(input), actor.id);
    return this.get(id);
  },

  async update(actor: AdminRecord, id: string, input: ActivityInputOutput): Promise<AdminActivityDetail> {
    const current = await requireActivity(id);
    if (current.status === 'archived') {
      throw new AppError(409, CODES.ACTIVITY_ARCHIVED, 'فعالیت بایگانی‌شده رو نمی‌شه ویرایش کرد');
    }
    if (current.status !== 'draft' && input.type !== current.type) {
      throw new ValidationError('نوع فعالیتِ منتشرشده عوض نمی‌شه', { fields: { type: 'نوع فعالیتِ منتشرشده عوض نمی‌شه' } });
    }

    // What has been published or answered is history: an edit becomes the next version.
    const newVersion = current.status !== 'draft' || current.stats.started > 0 || current.stats.responses > 0;
    await engagementRepository().update(id, toFields(input), actor.id, newVersion);
    return this.get(id);
  },

  async changeStatus(actor: AdminRecord, id: string, action: ActivityStatusAction): Promise<AdminActivityDetail> {
    const current = await requireActivity(id);
    if (action === 'publish' && current.endsAt && current.endsAt <= new Date()) {
      throw new ValidationError('تاریخ پایانِ این فعالیت گذشته؛ اول زمان‌بندی رو درست کن', {
        fields: { endsAt: 'پایان باید در آینده باشه' },
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
    if (!target) throw new NotFoundError('پاسخ پیدا نشد');

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

    if (outcome.status === 'reviewed') return { xpAwarded: outcome.xpAwarded };
    if (outcome.status === 'not_found') throw new NotFoundError('پاسخ پیدا نشد');
    throw new AppError(409, CODES.SUBMISSION_ALREADY_REVIEWED, 'این پاسخ قبلاً بررسی شده');
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
        throw new NotFoundError('تراکنش پیدا نشد');
      case 'not_revocable':
        throw new ValidationError('این تراکنش خودش یک ابطاله');
      case 'already_revoked':
        throw new AppError(409, CODES.XP_ALREADY_REVOKED, 'این امتیاز قبلاً باطل شده');
      case 'revoked':
        await engagementRepository().audit(outcome.activityId, actor.id, 'xp_revoked', {
          transactionId,
          amount: outcome.amount,
          reason,
        });
        return { revoked: true };
    }
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
    return {
      ...toCard(entry, now),
      instructions: activity.instructions,
      versionId: activity.versionId,
      steps: activity.definition.steps.map((step) => ({ ...step, questions: step.questions.map(toPlayerQuestion) })),
      anonymous: activity.definition.anonymous,
      review: activity.definition.review,
      submissions: participation?.submissions ?? 0,
      maxSubmissions: activity.definition.maxSubmissions,
      draft: participation?.draft ?? null,
      lastResult: activity.definition.assessment?.showResult ? entry.lastResult : null,
    };
  },

  async saveDraft(user: UserRecord, id: string, answers: ActivityAnswers): Promise<{ saved: true }> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now)) throw notFound();
    if (!canSubmit(entry, now)) {
      throw new AppError(409, CODES.ACTIVITY_CLOSED, 'این فعالیت الان پاسخ نمی‌پذیره');
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
    input: { versionId: string; answers: ActivityAnswers }
  ): Promise<ActivitySubmission> {
    const now = new Date();
    const entry = await engagementRepository().findForUser(id, user.id);
    if (!visibleTo(entry, now) || !entry.eligible) throw notFound();

    const { activity } = entry;
    if (!isOpen(activity, now)) {
      throw new AppError(409, CODES.ACTIVITY_CLOSED, 'مهلت این فعالیت تموم شده یا متوقف شده');
    }
    if (input.versionId !== activity.versionId) {
      throw new AppError(409, CODES.ACTIVITY_VERSION_CHANGED, 'این فعالیت به‌روز شده؛ صفحه رو دوباره باز کن');
    }

    const checked = validateAnswers(playerQuestions(activity), input.answers);
    if (!checked.ok) {
      throw new ValidationError(Object.values(checked.errors)[0], { fields: checked.errors });
    }

    const { definition } = activity;
    const result = scoreAssessment(definition, checked.answers);
    const completes = definition.review === 'auto';

    const outcome = await engagementRepository().submit({
      activityId: activity.id,
      versionId: activity.versionId,
      userId: user.id,
      anonymous: definition.anonymous,
      answers: checked.answers,
      result,
      score: result?.score ?? null,
      passed: result?.passed ?? null,
      maxSubmissions: definition.maxSubmissions,
      completes,
      // A reviewed mission is paid on approval, not here.
      reward:
        completes && earnsXp(definition, result)
          ? { xp: definition.xp.amount, maxAwards: definition.xp.maxAwards, reason: `«${activity.title}»` }
          : null,
    });

    if (outcome.status === 'pending_review') {
      throw new AppError(409, CODES.ACTIVITY_PENDING_REVIEW, 'پاسخ قبلیت هنوز در انتظار تأییده');
    }
    if (outcome.status !== 'submitted') {
      throw new AppError(409, CODES.ACTIVITY_LIMIT_REACHED, 'به سقف دفعات مجازِ این فعالیت رسیدی');
    }

    return {
      status: completes ? 'completed' : 'pending_review',
      xpAwarded: outcome.xpAwarded,
      xpTotal: await progressService.total(user.id),
      result: definition.assessment?.showResult ? result : null,
    };
  },
};
