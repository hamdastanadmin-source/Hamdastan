import type { ActivityTypeId } from '@hamdastan/config';

/**
 * Engagement Studio's wire contract — the activities the admin panel designs
 * (surveys, missions, assessments) and the product plays.
 *
 * One engine for all three: an activity is a versioned `ActivityDefinition`
 * of steps and questions, plus the few settings only one type uses. A survey
 * or an assessment is a single step; a mission is several.
 */

export type ActivityType = ActivityTypeId;

/**
 * `scheduled` is a published activity whose start is still ahead, and an
 * activity past its end reads `closed`; both are derived by the API.
 */
export type ActivityStatus = 'draft' | 'scheduled' | 'published' | 'paused' | 'closed' | 'archived';

// ─── Definition (versioned) ──────────────────────────────────────────────────

export type ChoiceOption = {
  id: string;
  label: string;
  /** Knowledge assessment: an answer key. Never sent to the product. */
  correct?: boolean;
  /** Personality assessment: points toward the question's dimension. Never sent to the product. */
  score?: number;
};

type QuestionBase = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  /** Personality assessment: the dimension this question measures. */
  dimensionId?: string;
  /** Personality assessment: a reverse-keyed item — its value counts from the other end. */
  reverse?: boolean;
};

export type ChoiceQuestion = QuestionBase & {
  kind: 'single' | 'multiple';
  options: ChoiceOption[];
  /** `multiple` only; absent means no cap. */
  maxSelections?: number;
};

export type TextQuestion = QuestionBase & { kind: 'text'; multiline: boolean };

/** 1..max, as a row of numbers. */
export type RatingQuestion = QuestionBase & { kind: 'rating'; max: 5 | 10 };

/** min..max on a slider, with a label at each end. */
export type ScaleQuestion = QuestionBase & {
  kind: 'scale';
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
};

export type ActivityQuestion = ChoiceQuestion | TextQuestion | RatingQuestion | ScaleQuestion;

export type ActivityStep = {
  id: string;
  /** Mission steps carry a title; a survey's single step leaves it empty. */
  title: string;
  description: string;
  questions: ActivityQuestion[];
};

export type AssessmentMode = 'personality' | 'knowledge';

export type AssessmentDimension = { id: string; title: string; description: string };

export type AssessmentSettings = {
  mode: AssessmentMode;
  /** Personality only. */
  dimensions: AssessmentDimension[];
  /** Knowledge only: the percentage that passes, or null for no pass mark. */
  passingScore: number | null;
  /** Whether the person sees their result. */
  showResult: boolean;
};

export type XpSettings = {
  enabled: boolean;
  /** A non-negative integer. */
  amount: number;
  /** Whether the reward is shown before the person starts. */
  showBeforeStart: boolean;
  /** How many submissions may be rewarded per person; 1 by default. */
  maxAwards: number;
  /** Knowledge assessment with a pass mark: reward only a pass. */
  requirePass: boolean;
};

export type ActivityDefinition = {
  steps: ActivityStep[];
  estimatedMinutes: number;
  /** How many times one person may submit. */
  maxSubmissions: number;
  /** Survey only: responses are stored without the person's identity. */
  anonymous: boolean;
  /** Mission only: `manual` waits for an admin before it completes or pays. */
  review: 'auto' | 'manual';
  /** Assessment only. */
  assessment: AssessmentSettings | null;
  xp: XpSettings;
};

/** Who an activity is for. Interest categories are the product's only groups today. */
export type ActivityAudience =
  | { kind: 'all' }
  | { kind: 'users'; phones: string[] }
  | { kind: 'interests'; categoryIds: string[] };

// ─── Admin ───────────────────────────────────────────────────────────────────

export type ActivityStats = {
  /** People the audience covers today. */
  eligible: number;
  /** People who opened and saved, or submitted. */
  started: number;
  /** People with a completed (and, for a reviewed mission, approved) submission. */
  completed: number;
  /** completed / eligible, 0–1. */
  participationRate: number;
  /** Submissions that were not rejected. */
  responses: number;
  pendingReviews: number;
  /** Net XP this activity has paid: grants less revocations. */
  xpAwarded: number;
  /** People whose net XP from this activity is above zero. */
  xpRecipients: number;
};

export type AdminActivitySummary = {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  title: string;
  audience: ActivityAudience;
  /** The current version's reward, or null when XP is off. */
  xpAmount: number | null;
  version: number;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stats: ActivityStats;
};

export type AdminActivityDetail = AdminActivitySummary & {
  summary: string;
  instructions: string;
  versionId: string;
  definition: ActivityDefinition;
};

/** `POST`/`PUT /admin/engagement/activities`. */
export type ActivityInput = {
  type: ActivityType;
  title: string;
  summary: string;
  instructions: string;
  definition: ActivityDefinition;
  audience: ActivityAudience;
  startsAt: string | null;
  endsAt: string | null;
};

export type ActivityStatusAction = 'publish' | 'pause' | 'resume' | 'close' | 'archive';

export type QuestionStat = {
  questionId: string;
  stepTitle: string;
  title: string;
  kind: ActivityQuestion['kind'];
  answered: number;
  /** Choice questions. */
  options?: { id: string; label: string; count: number }[];
  /** Rating and scale questions. */
  average?: number | null;
  distribution?: { value: number; count: number }[];
  /** Text questions: the latest answers, without who gave them. */
  texts?: string[];
};

export type AssessmentStats = {
  mode: AssessmentMode;
  /** Knowledge: the mean score, 0–100. */
  averageScore: number | null;
  /** Knowledge with a pass mark: passes / submissions, 0–1. */
  passRate: number | null;
  /** Personality: how many people each dimension came out on top for. */
  outcomes: { dimensionId: string; title: string; count: number }[];
};

export type ActivityResultsQuery = {
  from?: string;
  to?: string;
  /** An interest category; ignored for an anonymous survey. */
  categoryId?: string;
};

export type ActivityResults = {
  activity: AdminActivitySummary;
  anonymous: boolean;
  /** Whether a date or group filter narrowed the response figures. */
  filtered: boolean;
  /** The response figures, within the filter. */
  responses: number;
  questions: QuestionStat[];
  assessment: AssessmentStats | null;
};

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export type AdminPerson = { id: string; name: string; phone: string };

export type AdminSubmission = {
  id: string;
  user: AdminPerson;
  submittedAt: string;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  /** Each answer as a reviewer reads it. */
  answers: { questionId: string; title: string; value: string }[];
};

export type AdminXpGrant = {
  transactionId: string;
  user: AdminPerson;
  amount: number;
  /** The activity version that paid it. */
  version: number | null;
  createdAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type ActivityAuditAction =
  | 'created'
  | 'updated'
  | 'version_created'
  | 'published'
  | 'paused'
  | 'resumed'
  | 'closed'
  | 'archived'
  | 'duplicated'
  | 'submission_approved'
  | 'submission_rejected'
  | 'xp_revoked';

export type AdminActivityEvent = {
  id: string;
  action: ActivityAuditAction;
  adminName: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type ActivityExport = { filename: string; csv: string };

// ─── Product ─────────────────────────────────────────────────────────────────

export type ParticipationStatus = 'not_started' | 'in_progress' | 'pending_review' | 'completed' | 'rejected';

export type ActivityCard = {
  id: string;
  type: ActivityType;
  title: string;
  summary: string;
  estimatedMinutes: number;
  /** The reward, when XP is on and shown before starting; otherwise null. */
  xp: number | null;
  status: ParticipationStatus;
  endsAt: string | null;
  /** Open, and the person may start, continue or submit again. */
  canSubmit: boolean;
};

/** A question as the product receives it: no answer key, no scoring. */
export type PlayerQuestion =
  | (Omit<ChoiceQuestion, 'options' | 'dimensionId' | 'reverse'> & { options: { id: string; label: string }[] })
  | Omit<TextQuestion, 'dimensionId' | 'reverse'>
  | Omit<RatingQuestion, 'dimensionId' | 'reverse'>
  | Omit<ScaleQuestion, 'dimensionId' | 'reverse'>;

export type PlayerStep = Omit<ActivityStep, 'questions'> & { questions: PlayerQuestion[] };

/** One answer: an option id, several, a text, or a number. */
export type ActivityAnswerValue = string | string[] | number;
export type ActivityAnswers = Record<string, ActivityAnswerValue>;

export type AssessmentResult = {
  mode: AssessmentMode;
  /** Knowledge: 0–100. */
  score: number | null;
  /** Knowledge with a pass mark. */
  passed: boolean | null;
  /** Personality: each dimension, 0–100. */
  dimensions: { id: string; title: string; value: number }[];
  /** Personality: the dimension on top. */
  outcome: { title: string; description: string } | null;
};

export type PlayerActivity = ActivityCard & {
  instructions: string;
  versionId: string;
  steps: PlayerStep[];
  anonymous: boolean;
  review: 'auto' | 'manual';
  submissions: number;
  maxSubmissions: number;
  /** Saved progress, if any. */
  draft: ActivityAnswers | null;
  /** The latest result, when the assessment shows one. */
  lastResult: AssessmentResult | null;
};

/** `POST /me/activities/:id/submit`. */
export type ActivitySubmission = {
  status: Extract<ParticipationStatus, 'completed' | 'pending_review'>;
  /** What this submission actually added to the ledger — 0 when nothing was granted. */
  xpAwarded: number;
  /** The person's XP after it. */
  xpTotal: number;
  result: AssessmentResult | null;
};

/** The stable `code` values both apps switch on. */
export const ENGAGEMENT_ERROR_CODES = {
  ACTIVITY_CLOSED: 'ACTIVITY_CLOSED',
  ACTIVITY_LIMIT_REACHED: 'ACTIVITY_LIMIT_REACHED',
  ACTIVITY_PENDING_REVIEW: 'ACTIVITY_PENDING_REVIEW',
  ACTIVITY_VERSION_CHANGED: 'ACTIVITY_VERSION_CHANGED',
  ACTIVITY_INVALID_TRANSITION: 'ACTIVITY_INVALID_TRANSITION',
  ACTIVITY_ARCHIVED: 'ACTIVITY_ARCHIVED',
  SUBMISSION_ALREADY_REVIEWED: 'SUBMISSION_ALREADY_REVIEWED',
  XP_ALREADY_REVOKED: 'XP_ALREADY_REVOKED',
} as const;
