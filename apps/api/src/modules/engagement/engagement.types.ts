import type {
  ActivityAnswerValue,
  ActivityAnswers,
  ActivityAudience,
  ActivityDefinition,
  ActivityStats,
  ActivityType,
  AdminPerson,
  AssessmentResult,
  ReviewStatus,
} from '@hamdastan/types';

import type { IdempotencyRef } from '../../shared/idempotency';

/**
 * Types internal to the Engagement module. What leaves the API is in
 * `@hamdastan/types`; this is what the repository returns.
 */

/** `v2_activity_status` — what is stored. `scheduled` is derived from it. */
export type StoredActivityStatus = 'draft' | 'published' | 'paused' | 'closed' | 'archived';

export type ActivityRecord = {
  id: string;
  type: ActivityType;
  status: StoredActivityStatus;
  title: string;
  summary: string;
  instructions: string;
  audience: ActivityAudience;
  versionId: string;
  version: number;
  definition: ActivityDefinition;
  startsAt: Date | null;
  endsAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminActivityRecord = ActivityRecord & { stats: ActivityStats };

/** The fields a create or an edit writes, already validated. */
export type ActivityFields = {
  type: ActivityType;
  title: string;
  summary: string;
  instructions: string;
  definition: ActivityDefinition;
  audience: ActivityAudience;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type ActivityListQuery = {
  status?: 'draft' | 'scheduled' | 'published' | 'paused' | 'closed' | 'archived';
  type?: ActivityType;
  search?: string;
  page: number;
  pageSize: number;
};

export type ParticipationRecord = {
  status: 'in_progress' | 'pending_review' | 'completed' | 'rejected';
  submissions: number;
  xpAwards: number;
  draft: ActivityAnswers | null;
  completedAt: Date | null;
};

/** An activity as one person sees it. */
export type UserActivityRecord = {
  activity: ActivityRecord;
  /** Whether the audience covers this person today. */
  eligible: boolean;
  participation: ParticipationRecord | null;
  /** The latest response's result, if it carried one. */
  lastResult: AssessmentResult | null;
};

/** What a submission writes, every decision already made by the service. */
export type SubmissionWrite = {
  activityId: string;
  versionId: string;
  userId: string;
  anonymous: boolean;
  answers: ActivityAnswers;
  result: AssessmentResult | null;
  /** The part of `result` the person is shown; what a replay answers with. */
  visibleResult: AssessmentResult | null;
  score: number | null;
  passed: boolean | null;
  maxSubmissions: number;
  /** False when an admin must approve first: it waits, and pays nothing yet. */
  completes: boolean;
  /** The reward, when this submission earns one; capped by `maxAwards`. */
  reward: { xp: number; maxAwards: number; reason: string } | null;
  /**
   * The request's idempotency key, when it sent one. Claimed on the same
   * transaction as the response and the reward, and answered from on retry.
   */
  idempotency: IdempotencyRef | null;
};

/**
 * What a submission came to — and, with an idempotency key, exactly what a
 * retry of it is answered with, so a `submitted` carries what the response
 * is built from.
 */
export type SubmissionOutcome =
  | { status: 'submitted'; xpAwarded: number; completes: boolean; result: AssessmentResult | null }
  | { status: 'limit_reached' | 'pending_review' };

export type ResponseRow = {
  id: string;
  versionId: string;
  answers: ActivityAnswers;
  result: AssessmentResult | null;
  score: number | null;
  passed: boolean | null;
  submittedAt: Date;
  /** Null for an anonymous response. */
  user: AdminPerson | null;
};

export type ResponseFilter = { from?: Date; to?: Date; categoryId?: string };

export type SubmissionRow = {
  id: string;
  user: AdminPerson;
  definition: ActivityDefinition;
  answers: ActivityAnswers;
  submittedAt: Date;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
};

export type ReviewTarget = {
  activityId: string;
  /** Who answered; null for an anonymous response. */
  userId: string | null;
  activityTitle: string;
  definition: ActivityDefinition;
  versionId: string;
  reviewStatus: ReviewStatus;
};

export type ReviewWrite = {
  responseId: string;
  decision: 'approve' | 'reject';
  note: string | null;
  adminId: string;
  reward: { xp: number; maxAwards: number; reason: string } | null;
};

export type ReviewOutcome =
  | { status: 'reviewed'; xpAwarded: number }
  | { status: 'not_found' | 'already_reviewed' };

export type GrantRow = {
  transactionId: string;
  user: AdminPerson;
  amount: number;
  version: number | null;
  createdAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
};

export type AuditRow = {
  id: string;
  action: string;
  adminName: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
};

// ─── Journey ─────────────────────────────────────────────────────────────────

/** A person's kept result. */
export type JourneyResultRecord = {
  character: { id: string; name: string; title: string; description: string; imageId: string | null };
  traits: { id: string; title: string; score: number }[];
  createdAt: Date;
};

/** One person's journey, as stored: every answer they gave, and the days they finished. */
export type JourneyProgressRecord = {
  /** By question id; null for a skipped optional question. */
  answers: Record<string, ActivityAnswerValue | null>;
  /** By day id. */
  completedDays: Map<string, Date>;
  /** Net XP by ledger source id (`<activity>:q:<question>`, `<activity>:d:<day>`), reversals taken off. */
  xp: Map<string, number>;
};

type Reward = { xp: number; reason: string } | null;

/** One journey answer, every decision about it already made by the service. */
export type JourneyAnswerWrite = {
  activityId: string;
  versionId: string;
  userId: string;
  dayId: string;
  /** Every question the day has now: it is finished once each has an answer. */
  dayQuestionIds: string[];
  questionId: string;
  /** Null records a skipped optional question. */
  value: ActivityAnswerValue | null;
  /**
   * The days that must be finished for the journey to be: every day, less
   * any already missed for good.
   */
  requiredDayIds: string[];
  rewards: { question: Reward; day: Reward; journey: Reward };
};

export type JourneyAnswerResult =
  | {
      status: 'recorded';
      xpAwarded: { question: number; day: number; journey: number };
      dayCompleted: boolean;
      journeyCompleted: boolean;
    }
  /** The question already had an answer; it is returned, and nothing was written. */
  | { status: 'already_answered'; value: ActivityAnswerValue | null };
