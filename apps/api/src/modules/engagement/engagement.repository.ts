import type {
  ActivityAnswers,
  ActivityAudience,
  ActivityDefinition,
  ActivityType,
  AssessmentResult,
  ReviewStatus,
} from '@hamdastan/types';

import {
  claimIdempotency,
  completeIdempotency,
  findIdempotency,
  query,
  queryOne,
  withTransaction,
  type DbClient,
} from '../../data';
import {
  IDEMPOTENCY_TTL_SECONDS,
  type IdempotencyRef,
  type StoredIdempotency,
} from '../../shared/idempotency';
import { createRepositorySlot } from '../../shared/repository';
import { grantWithin } from '../progress';

import type {
  ActivityFields,
  ActivityListQuery,
  ActivityRecord,
  AdminActivityRecord,
  AuditRow,
  GrantRow,
  ParticipationRecord,
  ResponseFilter,
  ResponseRow,
  ReviewOutcome,
  ReviewTarget,
  ReviewWrite,
  StoredActivityStatus,
  SubmissionOutcome,
  SubmissionRow,
  SubmissionWrite,
  UserActivityRecord,
} from './engagement.types';

/**
 * Data access port for the Engagement module, and the PostgreSQL adapter
 * that satisfies it: activities and their versions, participation,
 * responses and the admin history (`v2_engagement_*`).
 *
 * Its rewards go into the one XP ledger through `grantWithin` from Progress,
 * inside the same transaction as the response that earned them — a
 * submission and its reward land together or not at all. It reads the
 * ledger for the dashboard; it never updates or deletes a ledger row.
 */
export interface EngagementRepository {
  // ─── Admin ─────────────────────────────────────────────────────
  list(query: ActivityListQuery): Promise<{ items: AdminActivityRecord[]; total: number }>;
  findById(id: string): Promise<AdminActivityRecord | null>;
  /** A draft at version 1. Answers with its id. */
  create(fields: ActivityFields, adminId: string): Promise<string>;
  /**
   * Writes the fields. With `newVersion` the definition becomes a new
   * version and the old one stays as the responses to it left it; without,
   * the current version is rewritten (a draft nobody has answered).
   */
  update(id: string, fields: ActivityFields, adminId: string, newVersion: boolean): Promise<void>;
  /** Moves the status only from one of `from`; false when it was in none of them. */
  setStatus(id: string, to: StoredActivityStatus, from: StoredActivityStatus[], adminId: string, action: string): Promise<boolean>;
  /** A new draft with the current version's content. Answers with its id. */
  duplicate(id: string, title: string, adminId: string): Promise<string>;
  countAudience(audience: ActivityAudience): Promise<number>;
  listResponses(activityId: string, filter: ResponseFilter): Promise<ResponseRow[]>;
  listSubmissions(
    activityId: string,
    query: { status?: ReviewStatus; page: number; pageSize: number }
  ): Promise<{ items: SubmissionRow[]; total: number }>;
  findReviewTarget(responseId: string): Promise<ReviewTarget | null>;
  review(write: ReviewWrite): Promise<ReviewOutcome>;
  listGrants(activityId: string, query: { page: number; pageSize: number }): Promise<{ items: GrantRow[]; total: number }>;
  listHistory(activityId: string): Promise<AuditRow[]>;
  audit(activityId: string | null, adminId: string, action: string, details?: Record<string, unknown>): Promise<void>;

  // ─── Product ───────────────────────────────────────────────────
  /** Open activities the person is in the audience of, and any they already took part in. */
  listForUser(userId: string, now: Date): Promise<UserActivityRecord[]>;
  findForUser(activityId: string, userId: string): Promise<UserActivityRecord | null>;
  saveDraft(activityId: string, userId: string, answers: ActivityAnswers): Promise<void>;
  /**
   * Stores a response and pays its reward, in one transaction. With an
   * idempotency key, a key already used answers with what it recorded —
   * `mismatch` when that was a different request — and nothing is written.
   */
  submit(write: SubmissionWrite): Promise<SubmissionOutcome | { status: 'key_mismatch' }>;
  /** What an idempotency key recorded, if anything — read before any work. */
  findSubmission(ref: IdempotencyRef): Promise<StoredIdempotency<SubmissionOutcome> | null>;
}

const slot = createRepositorySlot<EngagementRepository>('engagement');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const engagementRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setEngagementRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

/**
 * Whether the user `u` is in the audience held in `audience` — a column or a
 * bound `jsonb` parameter. Interest categories are matched on the person's
 * stage-1 picks.
 */
const audienceMatch = (audience: string) => `(
     ${audience}->>'kind' = 'all'
  OR (${audience}->>'kind' = 'users' AND ${audience}->'phones' ? u.phone)
  OR (${audience}->>'kind' = 'interests' AND EXISTS (
        SELECT 1 FROM v2_user_interests i
         WHERE i.user_id = u.id AND ${audience}->'categoryIds' ? i.category_id)))`;

const ACTIVITY_COLUMNS = `
  a.id, a.type, a.status, a.title, a.summary, a.instructions, a.audience,
  a.current_version_id AS version_id, v.version, v.definition,
  a.starts_at, a.ends_at, a.published_at, a.created_at, a.updated_at`;

const ACTIVITY_FROM = `
  FROM v2_engagement_activities a
  JOIN v2_engagement_versions v ON v.id = a.current_version_id`;

const STATS_COLUMNS = `
  (SELECT count(*) FROM v2_users u WHERE u.status = 'ACTIVE' AND ${audienceMatch('a.audience')})::int AS eligible,
  (SELECT count(*) FROM v2_engagement_participations p WHERE p.activity_id = a.id)::int AS started,
  (SELECT count(*) FROM v2_engagement_participations p
    WHERE p.activity_id = a.id AND p.completed_at IS NOT NULL)::int AS completed,
  (SELECT count(*) FROM v2_engagement_responses r
    WHERE r.activity_id = a.id AND r.review_status <> 'rejected')::int AS responses,
  (SELECT count(*) FROM v2_engagement_responses r
    WHERE r.activity_id = a.id AND r.review_status = 'pending')::int AS pending_reviews,
  (SELECT COALESCE(sum(t.xp_amount), 0) FROM v2_xp_transactions t WHERE t.activity_id = a.id)::int AS xp_awarded,
  (SELECT count(*) FROM (SELECT t.user_id FROM v2_xp_transactions t
                          WHERE t.activity_id = a.id
                       GROUP BY t.user_id HAVING sum(t.xp_amount) > 0) paid)::int AS xp_recipients`;

/** A person as an admin sees them: the name from basic info, else the display name. */
const PERSON_NAME = `COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), u.display_name, '')`;

type ActivityRow = {
  id: string;
  type: ActivityType;
  status: StoredActivityStatus;
  title: string;
  summary: string;
  instructions: string;
  audience: ActivityAudience;
  version_id: string;
  version: number;
  definition: ActivityDefinition;
  starts_at: Date | null;
  ends_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type StatsRow = {
  eligible: number;
  started: number;
  completed: number;
  responses: number;
  pending_reviews: number;
  xp_awarded: number;
  xp_recipients: number;
};

type ParticipationRow = {
  p_status: ParticipationRecord['status'] | null;
  p_submissions: number | null;
  p_xp_awards: number | null;
  p_draft: ActivityAnswers | null;
  p_completed_at: Date | null;
};

function toActivity(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: row.summary,
    instructions: row.instructions,
    audience: row.audience,
    versionId: row.version_id,
    version: row.version,
    definition: row.definition,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toAdminActivity(row: ActivityRow & StatsRow): AdminActivityRecord {
  return {
    ...toActivity(row),
    stats: {
      eligible: row.eligible,
      started: row.started,
      completed: row.completed,
      participationRate: row.eligible > 0 ? row.completed / row.eligible : 0,
      responses: row.responses,
      pendingReviews: row.pending_reviews,
      xpAwarded: row.xp_awarded,
      xpRecipients: row.xp_recipients,
    },
  };
}

function toParticipation(row: ParticipationRow): ParticipationRecord | null {
  if (!row.p_status) return null;
  return {
    status: row.p_status,
    submissions: row.p_submissions ?? 0,
    xpAwards: row.p_xp_awards ?? 0,
    draft: row.p_draft,
    completedAt: row.p_completed_at,
  };
}

/**
 * The list's status filter, in stored terms: `scheduled` and a `published`
 * activity past its end are told apart by the clock, not by a column. The
 * other statuses are their column value, bound as `$3`.
 */
function statusCondition(status: ActivityListQuery['status']): string {
  switch (status) {
    case undefined:
      return 'TRUE';
    case 'scheduled':
      return `a.status = 'published' AND a.starts_at > now()`;
    case 'published':
      return `a.status = 'published' AND (a.starts_at IS NULL OR a.starts_at <= now())
              AND (a.ends_at IS NULL OR a.ends_at > now())`;
    case 'closed':
      return `(a.status = 'closed' OR (a.status = 'published' AND a.ends_at <= now()))`;
    default:
      return `a.status = $3::v2_activity_status`;
  }
}

/** `%` and `_` in a search are literal characters, not wildcards. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (char) => `\\${char}`);

async function writeAudit(
  client: DbClient,
  activityId: string | null,
  adminId: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await client.query(
    `INSERT INTO v2_engagement_audit_log (activity_id, admin_id, action, details) VALUES ($1, $2, $3, $4)`,
    [activityId, adminId, action, details]
  );
}

/** Inserts an activity and its first version, and points one at the other. */
async function insertActivity(
  client: DbClient,
  fields: ActivityFields,
  adminId: string
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO v2_engagement_activities
            (type, title, summary, instructions, audience, starts_at, ends_at, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING id`,
    [
      fields.type,
      fields.title,
      fields.summary,
      fields.instructions,
      fields.audience,
      fields.startsAt,
      fields.endsAt,
      adminId,
    ]
  );
  const id = rows[0].id;
  const version = await client.query<{ id: string }>(
    `INSERT INTO v2_engagement_versions (activity_id, version, definition, created_by)
     VALUES ($1, 1, $2, $3) RETURNING id`,
    [id, fields.definition, adminId]
  );
  await client.query(`UPDATE v2_engagement_activities SET current_version_id = $2 WHERE id = $1`, [
    id,
    version.rows[0].id,
  ]);
  return id;
}

/**
 * Pays the next reward the participation still has room for. The
 * participation row is already locked by the caller, so `xp_awards` cannot
 * move under it; the ledger's unique key on `<activity>:<n>` is the second
 * guard. Answers with the XP added.
 */
async function payReward(
  client: DbClient,
  activityId: string,
  versionId: string,
  userId: string,
  xpAwards: number,
  reward: { xp: number; maxAwards: number; reason: string } | null
): Promise<number> {
  if (!reward || xpAwards >= reward.maxAwards) return 0;
  const granted = await grantWithin(client, userId, {
    sourceType: 'engagement',
    sourceId: `${activityId}:${xpAwards + 1}`,
    xp: reward.xp,
    activityId,
    activityVersionId: versionId,
    reason: reward.reason,
  });
  if (!granted) return 0;
  await client.query(
    `UPDATE v2_engagement_participations SET xp_awards = xp_awards + 1
      WHERE activity_id = $1 AND user_id = $2`,
    [activityId, userId]
  );
  return reward.xp;
}

const USER_ACTIVITY_SELECT = `
  SELECT ${ACTIVITY_COLUMNS},
         (u.status = 'ACTIVE' AND ${audienceMatch('a.audience')}) AS eligible,
         p.status AS p_status, p.submissions AS p_submissions, p.xp_awards AS p_xp_awards,
         p.draft AS p_draft, p.completed_at AS p_completed_at,
         (SELECT r.result FROM v2_engagement_responses r
           WHERE r.activity_id = a.id AND r.user_id = u.id AND r.result IS NOT NULL
        ORDER BY r.submitted_at DESC LIMIT 1) AS last_result
  ${ACTIVITY_FROM}
  JOIN v2_users u ON u.id = $1
  LEFT JOIN v2_engagement_participations p ON p.activity_id = a.id AND p.user_id = u.id`;

type UserActivityRow = ActivityRow & ParticipationRow & { eligible: boolean; last_result: AssessmentResult | null };

const toUserActivity = (row: UserActivityRow): UserActivityRecord => ({
  activity: toActivity(row),
  eligible: row.eligible,
  participation: toParticipation(row),
  lastResult: row.last_result,
});

export const sqlEngagementRepository: EngagementRepository = {
  async list({ status, type, search, page, pageSize }) {
    const where = `WHERE ($1::v2_activity_type IS NULL OR a.type = $1)
                     AND ($2::text IS NULL OR a.title ILIKE $2)
                     AND ${statusCondition(status)}`;
    const usesStatusParam = status === 'draft' || status === 'paused' || status === 'archived';
    const params = [type ?? null, search ? `%${escapeLike(search)}%` : null, ...(usesStatusParam ? [status] : [])];
    const next = params.length + 1;

    const [rows, count] = await Promise.all([
      query<ActivityRow & StatsRow>(
        `SELECT ${ACTIVITY_COLUMNS}, ${STATS_COLUMNS} ${ACTIVITY_FROM} ${where}
          ORDER BY a.created_at DESC, a.id
          LIMIT $${next} OFFSET $${next + 1}`,
        [...params, pageSize, (page - 1) * pageSize]
      ),
      queryOne<{ total: string }>(
        `SELECT count(*)::text AS total ${ACTIVITY_FROM} ${where}`,
        params
      ),
    ]);
    return { items: rows.map(toAdminActivity), total: Number(count?.total ?? 0) };
  },

  async findById(id) {
    const row = await queryOne<ActivityRow & StatsRow>(
      `SELECT ${ACTIVITY_COLUMNS}, ${STATS_COLUMNS} ${ACTIVITY_FROM} WHERE a.id = $1`,
      [id]
    );
    return row ? toAdminActivity(row) : null;
  },

  async create(fields, adminId) {
    return withTransaction(async (client) => {
      const id = await insertActivity(client, fields, adminId);
      await writeAudit(client, id, adminId, 'created', { type: fields.type });
      return id;
    });
  },

  async update(id, fields, adminId, newVersion) {
    await withTransaction(async (client) => {
      // Locked so two admins saving at once take turns at the version number.
      const { rows } = await client.query<{ current_version_id: string; version: number }>(
        `SELECT a.current_version_id, v.version ${ACTIVITY_FROM} WHERE a.id = $1 FOR UPDATE OF a`,
        [id]
      );
      const current = rows[0];
      let version = current.version;

      if (newVersion) {
        const { rows: latest } = await client.query<{ next: number }>(
          `SELECT max(version) + 1 AS next FROM v2_engagement_versions WHERE activity_id = $1`,
          [id]
        );
        version = latest[0].next;
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO v2_engagement_versions (activity_id, version, definition, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [id, version, fields.definition, adminId]
        );
        await client.query(`UPDATE v2_engagement_activities SET current_version_id = $2 WHERE id = $1`, [
          id,
          inserted.rows[0].id,
        ]);
      } else {
        await client.query(`UPDATE v2_engagement_versions SET definition = $2 WHERE id = $1`, [
          current.current_version_id,
          fields.definition,
        ]);
      }

      await client.query(
        `UPDATE v2_engagement_activities
            SET type = $2, title = $3, summary = $4, instructions = $5, audience = $6,
                starts_at = $7, ends_at = $8, updated_by = $9, updated_at = now()
          WHERE id = $1`,
        [
          id,
          fields.type,
          fields.title,
          fields.summary,
          fields.instructions,
          fields.audience,
          fields.startsAt,
          fields.endsAt,
          adminId,
        ]
      );
      await writeAudit(client, id, adminId, newVersion ? 'version_created' : 'updated', {
        version,
        xp: fields.definition.xp.enabled ? fields.definition.xp.amount : null,
      });
    });
  },

  async setStatus(id, to, from, adminId, action) {
    return withTransaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE v2_engagement_activities
            SET status = $2::v2_activity_status,
                published_at = CASE WHEN $2::v2_activity_status = 'published'
                                    THEN COALESCE(published_at, now()) ELSE published_at END,
                updated_by = $4, updated_at = now()
          WHERE id = $1 AND status = ANY($3::v2_activity_status[])`,
        [id, to, from, adminId]
      );
      if (!rowCount) return false;
      await writeAudit(client, id, adminId, action);
      return true;
    });
  },

  async duplicate(id, title, adminId) {
    return withTransaction(async (client) => {
      const { rows } = await client.query<ActivityRow>(
        `SELECT ${ACTIVITY_COLUMNS} ${ACTIVITY_FROM} WHERE a.id = $1`,
        [id]
      );
      const source = toActivity(rows[0]);
      // A copy starts as an unscheduled draft: its dates belonged to the original.
      const copyId = await insertActivity(
        client,
        { ...source, title, startsAt: null, endsAt: null },
        adminId
      );
      await writeAudit(client, copyId, adminId, 'duplicated', { from: id });
      return copyId;
    });
  },

  async countAudience(audience) {
    const row = await queryOne<{ total: number }>(
      `SELECT count(*)::int AS total FROM v2_users u WHERE u.status = 'ACTIVE' AND ${audienceMatch('$1::jsonb')}`,
      [audience]
    );
    return row?.total ?? 0;
  },

  async listResponses(activityId, { from, to, categoryId }) {
    const rows = await query<{
      id: string;
      version_id: string;
      answers: ActivityAnswers;
      result: AssessmentResult | null;
      score: string | null;
      passed: boolean | null;
      submitted_at: Date;
      user_id: string | null;
      name: string | null;
      phone: string | null;
    }>(
      `SELECT r.id, r.version_id, r.answers, r.result, r.score, r.passed, r.submitted_at,
              u.id AS user_id, ${PERSON_NAME} AS name, u.phone
         FROM v2_engagement_responses r
    LEFT JOIN v2_users u ON u.id = r.user_id
        WHERE r.activity_id = $1
          AND r.review_status <> 'rejected'
          AND ($2::timestamptz IS NULL OR r.submitted_at >= $2)
          AND ($3::timestamptz IS NULL OR r.submitted_at < $3)
          AND ($4::text IS NULL OR EXISTS (
                SELECT 1 FROM v2_user_interests i WHERE i.user_id = r.user_id AND i.category_id = $4))
     ORDER BY r.submitted_at DESC, r.id`,
      [activityId, from ?? null, to ?? null, categoryId ?? null]
    );
    return rows.map((row) => ({
      id: row.id,
      versionId: row.version_id,
      answers: row.answers,
      result: row.result,
      score: row.score === null ? null : Number(row.score),
      passed: row.passed,
      submittedAt: row.submitted_at,
      user: row.user_id ? { id: row.user_id, name: row.name ?? '', phone: row.phone ?? '' } : null,
    }));
  },

  async listSubmissions(activityId, { status, page, pageSize }) {
    const where = `WHERE r.activity_id = $1 AND r.user_id IS NOT NULL
                     AND r.review_status <> 'none'
                     AND ($2::v2_review_status IS NULL OR r.review_status = $2)`;
    const [rows, count] = await Promise.all([
      query<{
        id: string;
        user_id: string;
        name: string;
        phone: string;
        definition: ActivityDefinition;
        answers: ActivityAnswers;
        submitted_at: Date;
        review_status: ReviewStatus;
        review_note: string | null;
        reviewed_at: Date | null;
      }>(
        `SELECT r.id, u.id AS user_id, ${PERSON_NAME} AS name, u.phone, v.definition, r.answers,
                r.submitted_at, r.review_status, r.review_note, r.reviewed_at
           FROM v2_engagement_responses r
           JOIN v2_users u ON u.id = r.user_id
           JOIN v2_engagement_versions v ON v.id = r.version_id
         ${where}
       ORDER BY r.submitted_at DESC, r.id
          LIMIT $3 OFFSET $4`,
        [activityId, status ?? null, pageSize, (page - 1) * pageSize]
      ),
      queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM v2_engagement_responses r ${where}`,
        [activityId, status ?? null]
      ),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        user: { id: row.user_id, name: row.name, phone: row.phone },
        definition: row.definition,
        answers: row.answers,
        submittedAt: row.submitted_at,
        reviewStatus: row.review_status,
        reviewNote: row.review_note,
        reviewedAt: row.reviewed_at,
      })),
      total: Number(count?.total ?? 0),
    };
  },

  async findReviewTarget(responseId) {
    const row = await queryOne<{
      activity_id: string;
      title: string;
      definition: ActivityDefinition;
      version_id: string;
      review_status: ReviewStatus;
    }>(
      `SELECT r.activity_id, a.title, v.definition, r.version_id, r.review_status
         FROM v2_engagement_responses r
         JOIN v2_engagement_activities a ON a.id = r.activity_id
         JOIN v2_engagement_versions v ON v.id = r.version_id
        WHERE r.id = $1`,
      [responseId]
    );
    return row
      ? {
          activityId: row.activity_id,
          activityTitle: row.title,
          definition: row.definition,
          versionId: row.version_id,
          reviewStatus: row.review_status,
        }
      : null;
  },

  async review({ responseId, decision, note, adminId, reward }) {
    return withTransaction(async (client): Promise<ReviewOutcome> => {
      // The response, then its participation, both locked: an approval
      // racing a second approval, or a resubmission, waits its turn.
      const { rows } = await client.query<{
        activity_id: string;
        version_id: string;
        user_id: string | null;
        review_status: ReviewStatus;
      }>(
        `SELECT activity_id, version_id, user_id, review_status
           FROM v2_engagement_responses WHERE id = $1 FOR UPDATE`,
        [responseId]
      );
      const response = rows[0];
      if (!response || !response.user_id) return { status: 'not_found' };
      if (response.review_status !== 'pending') return { status: 'already_reviewed' };

      const approved = decision === 'approve';
      await client.query(
        `UPDATE v2_engagement_responses
            SET review_status = $2, review_note = $3, reviewed_by = $4, reviewed_at = now()
          WHERE id = $1`,
        [responseId, approved ? 'approved' : 'rejected', note, adminId]
      );

      const { rows: participation } = await client.query<{ xp_awards: number }>(
        `SELECT xp_awards FROM v2_engagement_participations
          WHERE activity_id = $1 AND user_id = $2 FOR UPDATE`,
        [response.activity_id, response.user_id]
      );

      let xpAwarded = 0;
      if (approved) {
        await client.query(
          `UPDATE v2_engagement_participations
              SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
            WHERE activity_id = $1 AND user_id = $2`,
          [response.activity_id, response.user_id]
        );
        xpAwarded = await payReward(
          client,
          response.activity_id,
          response.version_id,
          response.user_id,
          participation[0]?.xp_awards ?? 0,
          reward
        );
      } else {
        // A rejected submission does not count against the limit, so the
        // person can do the mission again.
        await client.query(
          `UPDATE v2_engagement_participations
              SET status = CASE WHEN completed_at IS NULL THEN 'rejected'::v2_participation_status ELSE 'completed' END,
                  submissions = GREATEST(submissions - 1, 0), updated_at = now()
            WHERE activity_id = $1 AND user_id = $2`,
          [response.activity_id, response.user_id]
        );
      }

      await writeAudit(client, response.activity_id, adminId, approved ? 'submission_approved' : 'submission_rejected', {
        responseId,
        xpAwarded,
        ...(note ? { note } : {}),
      });
      return { status: 'reviewed', xpAwarded };
    });
  },

  async listGrants(activityId, { page, pageSize }) {
    const [rows, count] = await Promise.all([
      query<{
        id: string;
        user_id: string;
        name: string;
        phone: string;
        xp_amount: number;
        version: number | null;
        created_at: Date;
        revoked_at: Date | null;
        revoke_reason: string | null;
      }>(
        `SELECT t.id::text, u.id AS user_id, ${PERSON_NAME} AS name, u.phone, t.xp_amount, v.version,
                t.created_at, rv.created_at AS revoked_at, rv.reason AS revoke_reason
           FROM v2_xp_transactions t
           JOIN v2_users u ON u.id = t.user_id
      LEFT JOIN v2_engagement_versions v ON v.id = t.activity_version_id
      LEFT JOIN v2_xp_transactions rv ON rv.reverses_id = t.id
          WHERE t.activity_id = $1 AND t.source_type = 'engagement'
       ORDER BY t.created_at DESC, t.id DESC
          LIMIT $2 OFFSET $3`,
        [activityId, pageSize, (page - 1) * pageSize]
      ),
      queryOne<{ total: string }>(
        `SELECT count(*)::text AS total FROM v2_xp_transactions
          WHERE activity_id = $1 AND source_type = 'engagement'`,
        [activityId]
      ),
    ]);
    return {
      items: rows.map((row) => ({
        transactionId: row.id,
        user: { id: row.user_id, name: row.name, phone: row.phone },
        amount: row.xp_amount,
        version: row.version,
        createdAt: row.created_at,
        revokedAt: row.revoked_at,
        revokeReason: row.revoke_reason,
      })),
      total: Number(count?.total ?? 0),
    };
  },

  async listHistory(activityId) {
    const rows = await query<{
      id: string;
      action: string;
      admin_name: string | null;
      details: Record<string, unknown>;
      created_at: Date;
    }>(
      `SELECT l.id::text, l.action, l.details, l.created_at,
              NULLIF(trim(concat_ws(' ', ad.first_name, ad.last_name)), '') AS admin_name
         FROM v2_engagement_audit_log l
    LEFT JOIN v2_admin_users ad ON ad.id = l.admin_id
        WHERE l.activity_id = $1
     ORDER BY l.created_at DESC, l.id DESC
        LIMIT 100`,
      [activityId]
    );
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      adminName: row.admin_name,
      details: row.details,
      createdAt: row.created_at,
    }));
  },

  async audit(activityId, adminId, action, details = {}) {
    await query(
      `INSERT INTO v2_engagement_audit_log (activity_id, admin_id, action, details) VALUES ($1, $2, $3, $4)`,
      [activityId, adminId, action, details]
    );
  },

  async listForUser(userId, now) {
    const rows = await query<UserActivityRow>(
      `${USER_ACTIVITY_SELECT}
        WHERE (a.status = 'published'
               AND u.status = 'ACTIVE' AND ${audienceMatch('a.audience')}
               AND (a.starts_at IS NULL OR a.starts_at <= $2)
               AND (a.ends_at IS NULL OR a.ends_at > $2))
           OR (p.user_id IS NOT NULL AND a.status IN ('published', 'paused', 'closed'))
     ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC`,
      [userId, now]
    );
    return rows.map(toUserActivity);
  },

  async findForUser(activityId, userId) {
    const row = await queryOne<UserActivityRow>(`${USER_ACTIVITY_SELECT} WHERE a.id = $2`, [userId, activityId]);
    return row ? toUserActivity(row) : null;
  },

  async saveDraft(activityId, userId, answers) {
    await query(
      `INSERT INTO v2_engagement_participations (activity_id, user_id, draft)
       VALUES ($1, $2, $3)
       ON CONFLICT (activity_id, user_id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = now()`,
      [activityId, userId, answers]
    );
  },

  async findSubmission(ref) {
    return findIdempotency<SubmissionOutcome>(ref);
  },

  async submit(write) {
    return withTransaction(async (client): Promise<SubmissionOutcome | { status: 'key_mismatch' }> => {
      // Claimed first, on this transaction: a retry that arrives while this
      // one is still running waits here, then answers from what it records.
      if (write.idempotency) {
        const stored = await claimIdempotency<SubmissionOutcome>(
          client,
          write.idempotency,
          IDEMPOTENCY_TTL_SECONDS
        );
        if (stored?.state === 'mismatch') return { status: 'key_mismatch' };
        if (stored) return stored.outcome;
      }
      const finish = async (outcome: SubmissionOutcome): Promise<SubmissionOutcome> => {
        if (write.idempotency) await completeIdempotency(client, write.idempotency, outcome);
        return outcome;
      };

      // The row exists before it is locked, so a first submission and a
      // concurrent one both queue on it rather than both inserting.
      await client.query(
        `INSERT INTO v2_engagement_participations (activity_id, user_id) VALUES ($1, $2)
         ON CONFLICT (activity_id, user_id) DO NOTHING`,
        [write.activityId, write.userId]
      );
      const { rows } = await client.query<{ status: ParticipationRecord['status']; submissions: number; xp_awards: number }>(
        `SELECT status, submissions, xp_awards FROM v2_engagement_participations
          WHERE activity_id = $1 AND user_id = $2 FOR UPDATE`,
        [write.activityId, write.userId]
      );
      const participation = rows[0];
      if (participation.status === 'pending_review') return finish({ status: 'pending_review' });
      if (participation.submissions >= write.maxSubmissions) return finish({ status: 'limit_reached' });

      // An anonymous response carries no person, and only the (UTC) day it
      // came in — the participation's own timestamps cannot be matched to it.
      await client.query(
        `INSERT INTO v2_engagement_responses
                (activity_id, version_id, user_id, answers, result, score, passed, review_status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                 CASE WHEN $9 THEN date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' ELSE now() END)`,
        [
          write.activityId,
          write.versionId,
          write.anonymous ? null : write.userId,
          write.answers,
          write.result,
          write.score,
          write.passed,
          write.completes ? 'none' : 'pending',
          write.anonymous,
        ]
      );

      await client.query(
        `UPDATE v2_engagement_participations
            SET submissions = submissions + 1,
                draft = NULL,
                status = $3,
                completed_at = CASE WHEN $4 THEN COALESCE(completed_at, now()) ELSE completed_at END,
                updated_at = now()
          WHERE activity_id = $1 AND user_id = $2`,
        [write.activityId, write.userId, write.completes ? 'completed' : 'pending_review', write.completes]
      );

      const xpAwarded = write.completes
        ? await payReward(client, write.activityId, write.versionId, write.userId, participation.xp_awards, write.reward)
        : 0;
      return finish({ status: 'submitted', xpAwarded, completes: write.completes, result: write.visibleResult });
    });
  },
};
