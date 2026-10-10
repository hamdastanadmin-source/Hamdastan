import type {
  ActivityAnswers,
  ActivityAudience,
  ActivityDefinition,
  ActivityStats,
  ActivityType,
  AdminPerson,
  AssessmentResult,
  ReviewStatus,
} from '@hamdastan/types';

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
  score: number | null;
  passed: boolean | null;
  maxSubmissions: number;
  /** False when an admin must approve first: it waits, and pays nothing yet. */
  completes: boolean;
  /** The reward, when this submission earns one; capped by `maxAwards`. */
  reward: { xp: number; maxAwards: number; reason: string } | null;
};

export type SubmissionOutcome =
  | { status: 'submitted'; xpAwarded: number }
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
