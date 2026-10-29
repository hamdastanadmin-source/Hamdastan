import type { ActivityTypeId, ResultSectionId } from '@hamdastan/config';

import type { Gender } from './auth';
import type { MotionSetting, PlayerMedia } from './media';

/**
 * Engagement Studio's wire contract — the activities the admin panel designs
 * (surveys, missions, assessments, journeys) and the product plays.
 *
 * One engine for all four: an activity is a versioned `ActivityDefinition`
 * of steps and questions, plus the few settings only one type uses. A survey
 * or an assessment is a single step; a mission is several; a journey is one
 * step per day, unlocked day by day.
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
  /** An image option's may be left empty; the API then names it «تصویر n». */
  label: string;
  /** An image option's picture, from the media library. */
  imageId?: string;
  /** Knowledge assessment: an answer key. Never sent to the product. */
  correct?: boolean;
  /**
   * Personality assessment: this option's points toward each dimension, by
   * dimension id — positive, negative, or absent for zero. One option may
   * score several dimensions. Never sent to the product.
   */
  dimensionScores?: Record<string, number>;
  /**
   * Legacy personality scoring: points toward the question's `dimensionId`.
   * Only in versions stored before `dimensionScores`; `withDimensionScores` reads it.
   */
  score?: number;
  /** Journey: points this option gives each trait, by trait id. Never sent to the product. */
  traits?: Record<string, number>;
  /**
   * Profile assessment: this option's weight toward each result profile, by
   * profile id — positive, negative, or absent for zero. Never sent to the product.
   */
  weights?: Record<string, number>;
};

export type QuestionImagePosition = 'above' | 'below';

/** How a choice question's options are drawn: text rows (the default), or a grid of images. */
export type OptionStyle = 'text' | 'image';

type QuestionBase = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  /**
   * Personality assessment: the dimension a rating or scale measures. A
   * choice question scores dimensions through its options' `dimensionScores`
   * (it carries one only in a version stored before them).
   */
  dimensionId?: string;
  /** Personality assessment: a reverse-keyed rating or scale — its value counts from the other end. */
  reverse?: boolean;
  /** Profile assessment: what this question's option weights are multiplied by. Absent means 1. Never sent to the product. */
  weight?: number;
  /** An image from the media library, shown with the question. */
  imageId?: string;
  /** Where the image goes: above the question's text (the default), or between it and the answers. */
  imagePosition?: QuestionImagePosition;
  /** Journey: the motion after this question's answer, over the day's and the journey's. */
  motion?: MotionSetting;
};

export type ChoiceQuestion = QuestionBase & {
  kind: 'single' | 'multiple';
  options: ChoiceOption[];
  /** `image`: every option is a picture. Absent means text. */
  optionStyle?: OptionStyle;
  /**
   * Knowledge quiz: why the right answer is right. Never sent to the
   * product until the answers may be revealed (`AssessmentSettings.revealAnswers`).
   */
  explanation?: string;
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

/**
 * One pair of a matching question. The match has its own id, minted apart
 * from the pair's, so the product can be sent both columns without the key.
 */
export type MatchingPair = { id: string; prompt: string; matchId: string; match: string };

/** Duolingo-style: the person pairs every prompt with its match. Right only when every pair is. */
export type MatchingQuestion = QuestionBase & {
  kind: 'matching';
  pairs: MatchingPair[];
  /** Knowledge quiz: as a choice question's. */
  explanation?: string;
};

export type ActivityQuestion = ChoiceQuestion | TextQuestion | RatingQuestion | ScaleQuestion | MatchingQuestion;

/** How a journey day's cover comes in. */
export type CoverEntryEffect = 'none' | 'fade' | 'slide_up' | 'zoom';

/**
 * The screen a journey day opens on, before its first question. Every day
 * may have its own; its images and mascot come from the media library.
 */
export type DailyCover = {
  /** The short, exciting line: «آماده‌ای امروز بریم سراغ رازهای هاگوارتز؟» */
  headline: string;
  text: string;
  /** The start button: «بزن بریم!» */
  buttonLabel: string;
  /** The admin's own colour for this day's cover, `#rrggbb`; null keeps the app's surface. */
  background: string | null;
  entryEffect: CoverEntryEffect;
  /** An image from the library behind everything; null for none. */
  backgroundImageId: string | null;
  /** The mascot in the middle: an image or a motion, in any of the motion modes. */
  mascot: MotionSetting;
};

export type ActivityStep = {
  id: string;
  /** Mission steps and journey days carry a title; a survey's single step leaves it empty. */
  title: string;
  description: string;
  questions: ActivityQuestion[];
  /** Journey only: the day's start screen. Absent keeps the default one. */
  cover?: DailyCover;
  /** Journey only: the motion after an answer on this day, over the journey's. */
  answerMotion?: MotionSetting;
};

export type AssessmentMode = 'personality' | 'knowledge' | 'profile';

/** A result's picture: one for everybody, or — while `genderedImages` is on — one per gender. */
export type ResultImage = {
  /** An image from the media library, shown with the result when it is the one the person comes out as. */
  imageId?: string;
  /**
   * Whether a man and a woman see different images. While on, the person's
   * own image from `genderImageIds` is shown; without one — or without a
   * gender on their profile — `imageId` is. Turning it off keeps both.
   */
  genderedImages?: boolean;
  genderImageIds?: Partial<Record<Gender, string>>;
};

export type AssessmentDimension = ResultImage & {
  id: string;
  title: string;
  description: string;
};

/** Profile assessment: a result a person can come out as. */
export type AssessmentProfile = ResultImage & { id: string; title: string; description: string };

/**
 * The done screen of a survey, mission, assessment or competition. The
 * message replaces «ممنون که وقت گذاشتی» — an empty title or message keeps
 * the default — and `sections` is every block once, in the order shown.
 */
export type ResultPageSettings = {
  title: string;
  message: string;
  imageId: string | null;
  sections: ResultSectionId[];
};

/**
 * Profile assessment: how a tie on the top score is broken, in this order.
 * First the priority questions, one by one: of the tied profiles, those
 * that scored most on that question stay. If more than one still stays,
 * the default profile is the result.
 */
export type ProfileTieBreak = {
  /** Choice questions, in the order they are consulted. */
  priorityQuestionIds: string[];
  defaultProfileId: string | null;
};

export type AssessmentSettings = {
  mode: AssessmentMode;
  /** Personality only. */
  dimensions: AssessmentDimension[];
  /** Profile only: the results, in the admin's order. */
  profiles?: AssessmentProfile[];
  /** Profile only. */
  tieBreak?: ProfileTieBreak;
  /** Knowledge only: the percentage that passes, or null for no pass mark. */
  passingScore: number | null;
  /** Whether the person sees their result. */
  showResult: boolean;
  /**
   * Knowledge only: once the person has no submissions left — for a
   * competition, once it has ended — they see each question's right answer
   * and its explanation. Off by default.
   */
  revealAnswers: boolean;
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

/**
 * How a journey's days open. A journey is a campaign: it starts at the
 * activity's `startsAt` (required) and ends at midnight after its last
 * calendar day — the API derives `endsAt` from the start and the day count.
 *
 * `calendar_day`: day n opens at local midnight, n − 1 days after the
 * campaign's first day, in `timezone`; day 1 opens at the start.
 * `rolling_24h`: day n opens 24 hours after the person finished day n − 1.
 */
export type JourneyUnlockMode = 'calendar_day' | 'rolling_24h';

export type JourneySettings = {
  unlockMode: JourneyUnlockMode;
  /** An IANA zone; the day boundaries are its midnights. */
  timezone: string;
  /**
   * `catch_up` (default): an earlier day stays open until the campaign
   * ends, for whoever wants to go back to it. `lock`: once the next day
   * opens, it is missed for good. Calendar mode only.
   */
  missedDays: 'catch_up' | 'lock';
  /** Calendar mode: a day opens only once the one before it is finished (or missed). Off by default. */
  requirePreviousDay: boolean;
  /** Whether a finished day can be opened again to read back. */
  allowReview: boolean;
  /** The builder's target per day. Not enforced. */
  questionsPerDay: number;
  /**
   * XP for each answer and for each finished day. The reward for finishing
   * the whole journey is `xp.amount`; `xp.enabled` switches all three.
   */
  rewards: { perQuestion: number; perDay: number };
  /**
   * The journey's motions: after an answer (a day or a question may set its
   * own), after a day's last answer, and after the last day's.
   */
  motions: { answer: MotionSetting; dayComplete: MotionSetting; journeyComplete: MotionSetting };
  /** The page after a day's last answer, and the invitation on it. */
  dayEnd: JourneyDayEnd;
  /** The character card a finished journey ends on. */
  result: JourneyResultSettings;
};

/** Something an answer can show more of: «شجاعت», «هوش», «وفاداری»… */
export type JourneyTrait = { id: string; title: string };

/** A character a finished journey can come out as. */
export type JourneyCharacter = {
  id: string;
  name: string;
  /** A line under the name: «جادوگر کنجکاو». */
  title: string;
  description: string;
  /** Its picture, from the library. */
  imageId: string | null;
  /** The trait it stands for: the person whose top trait this is gets it. */
  traitId: string | null;
};

/** How the shareable card looks. */
export type ResultCardStyle = {
  brandName: string;
  /** A logo from the library; null shows the product's own. */
  logoId: string | null;
  /** The card's colour, `#rrggbb`; null keeps the product's surface. */
  background: string | null;
  /** Whether the person's first name may be printed on it. */
  showUserName: boolean;
};

/**
 * The final result. Each choice option may give points to traits; once the
 * journey is finished they are added up, and the character of the top trait
 * is the result (ties go to the trait listed first). With no points — or no
 * character for the top trait — the default character is. It is worked out
 * once, on the server, and kept: a refresh, an edit or a new version never
 * changes it.
 */
export type JourneyResultSettings = {
  enabled: boolean;
  traits: JourneyTrait[];
  characters: JourneyCharacter[];
  defaultCharacterId: string | null;
  card: ResultCardStyle;
};

/** A person's result, as kept when it was worked out. */
export type PlayerJourneyResult = {
  character: Pick<JourneyCharacter, 'id' | 'name' | 'title' | 'description' | 'imageId'>;
  /** Each trait's total, in the order the admin listed them. */
  traits: { id: string; title: string; score: number }[];
  card: ResultCardStyle;
  createdAt: string;
};

/**
 * The page a finished day ends on. `title` and `message` may say `{name}`
 * (the person's first name, or nothing), `{day}` (the day just finished)
 * and `{days}` (how many there are).
 */
export type JourneyDayEnd = {
  title: string;
  message: string;
  /** An image or a mascot on the page; its motion is the day's end motion. */
  mascot: MotionSetting;
  invite: {
    enabled: boolean;
    /** The line above the button: «دوستات هم می‌تونن وارد این ماجراجویی بشن…» */
    text: string;
    /** «دعوت از دوستان». */
    button: string;
    /** What the share sheet sends, before the link. */
    shareMessage: string;
  };
};

/** One «این یا اون» card: a library image and an optional caption. */
export type ThisOrThatCard = { id: string; imageId: string; title: string };

/**
 * «این یا اون»: the cards meet two at a time — the first two, then the
 * winner against the next — until one is left. The cards are the whole
 * content; the activity has no steps or questions.
 */
export type ThisOrThatSettings = {
  /** An image across the top of the intro; null for none. */
  coverImageId: string | null;
  /** `manual`: the admin's order. `random`: each person's own, fixed for them by the API. */
  order: 'manual' | 'random';
  cards: ThisOrThatCard[];
};

export type ActivityDefinition = {
  /** Empty for «این یا اون», whose content is `thisOrThat.cards`. */
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
  /** Journey only. */
  journey: JourneySettings | null;
  /** «این یا اون» only. Absent on a version stored before it existed. */
  thisOrThat?: ThisOrThatSettings | null;
  /** Absent on a version stored before the done screen could be designed: the defaults. */
  resultPage?: ResultPageSettings;
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
  /** The worlds it is filed under. Not part of a version. */
  worlds: { id: string; name: string }[];
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
  worldIds: string[];
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
  /** Matching questions: each pair, and how many people matched it right. */
  pairs?: { id: string; label: string; count: number }[];
};

export type AssessmentStats = {
  mode: AssessmentMode;
  /** Knowledge: the mean score, 0–100. */
  averageScore: number | null;
  /** Knowledge with a pass mark: passes / submissions, 0–1. */
  passRate: number | null;
  /** Personality: how many people each dimension came out on top for. Profile: each profile, its id as `dimensionId`. */
  outcomes: { dimensionId: string; title: string; count: number }[];
};

/** «این یا اون»: how each card did, best first. */
export type ThisOrThatCardStat = {
  id: string;
  title: string;
  imageId: string;
  /** Matches it won, across every response. */
  wins: number;
  /** Matches it played. */
  matches: number;
  /** How many people ended on it. */
  finalWins: number;
  /** finalWins over the responses, 0–1. */
  finalShare: number;
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
  /** «این یا اون»: the cards, the most chosen first. */
  thisOrThat: ThisOrThatCardStat[] | null;
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
  /** The worlds it is filed under, in the worlds' order; empty when none. */
  worlds: { id: string; name: string }[];
};

/** A question as the product receives it: no answer key, no scoring. */
export type PlayerQuestion =
  | (Omit<ChoiceQuestion, 'options' | 'dimensionId' | 'reverse' | 'weight'> & { options: { id: string; label: string; imageId?: string }[] })
  | Omit<TextQuestion, 'dimensionId' | 'reverse' | 'weight'>
  | Omit<RatingQuestion, 'dimensionId' | 'reverse' | 'weight'>
  | Omit<ScaleQuestion, 'dimensionId' | 'reverse' | 'weight'>
  | PlayerMatchingQuestion;

/**
 * A matching question as the product receives it: the prompts in the
 * admin's order and the matches in an order that says nothing of the key.
 * The answer is the match ids, one per prompt, in the prompts' order.
 */
export type PlayerMatchingQuestion = Omit<MatchingQuestion, 'pairs' | 'explanation' | 'dimensionId' | 'reverse' | 'weight'> & {
  prompts: { id: string; label: string }[];
  matches: { id: string; label: string }[];
};

export type PlayerStep = Omit<ActivityStep, 'questions'> & { questions: PlayerQuestion[] };

/** One answer: an option id, several (or a matching question's match ids), a text, or a number. */
export type ActivityAnswerValue = string | string[] | number;
export type ActivityAnswers = Record<string, ActivityAnswerValue>;

export type AssessmentResult = {
  mode: AssessmentMode;
  /** Knowledge: 0–100. */
  score: number | null;
  /** Knowledge with a pass mark. */
  passed: boolean | null;
  /** Personality: each dimension's share, 0–100; together they add up to 100. */
  dimensions: { id: string; title: string; value: number }[];
  /** Personality: the dimension on top. Profile: the profile that won. Either with its image, if it has one. */
  outcome: { title: string; description: string; imageId?: string } | null;
  /** Profile: every profile's weighted total, in the admin's order. */
  profiles?: { id: string; title: string; score: number }[];
  /** Profile: what settled a tie on the top score, or null when there was none. */
  tieBrokenBy?: 'priority_question' | 'default_profile' | null;
};

/**
 * A day as the person sees it, decided by the API on every read.
 * `missed` is a day that closed unfinished under `missedDays: 'lock'`.
 */
export type JourneyDayStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'missed';

export type PlayerJourneyDay = {
  /** The step's id. */
  id: string;
  /** 1-based. */
  number: number;
  /** Null while the day is locked: nothing of a locked day is sent. */
  title: string | null;
  status: JourneyDayStatus;
  /** Why a locked day is locked: its time has not come, or the day before is unfinished. */
  lockReason: 'schedule' | 'previous_day' | null;
  /** When it opens (or opened); null while that depends on something not done yet. */
  unlocksAt: string | null;
  /** When a day under `missedDays: 'lock'` stops taking answers. */
  closesAt: string | null;
  questionCount: number;
  answeredCount: number;
  completedAt: string | null;
  /** Net XP this day has paid the person: its answers and its finish. */
  xpEarned: number;
};

export type PlayerJourney = {
  days: PlayerJourneyDay[];
  completedDays: number;
  /** The next day still to open, if its time is known. */
  nextUnlockAt: string | null;
  /** Answers already given on the days the person may open; a skipped question is null. */
  answers: Record<string, ActivityAnswerValue | null>;
  /** What each answer, each day and the whole journey pay — null when XP is off. */
  rewards: { perQuestion: number; perDay: number; completion: number } | null;
  completedAt: string | null;
  /** The journey's own motions; a day's and a question's overrides travel with them. */
  motions: JourneySettings['motions'];
  dayEnd: JourneyDayEnd;
  /** The person's character card, once the journey is finished and results are on. */
  result: PlayerJourneyResult | null;
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
  /** The answers revealed for the person's last submission, when allowed (`revealAnswers`). */
  answerReview: AnswerReview[] | null;
  /**
   * Journey only. Its `steps` carry only the days the person may open (or,
   * if allowed, read back); a locked day is not sent at all — its number,
   * status and opening time are in `journey.days`.
   */
  journey: PlayerJourney | null;
  /**
   * «این یا اون» only: the cards in this person's order — the admin's, or
   * their own shuffle, which stays the same for them. The draft holds the
   * matches played (`thisOrThatAnswers`).
   */
  thisOrThat: { coverImageId: string | null; cards: ThisOrThatCard[] } | null;
  /** The done screen as the admin designed it, or its defaults. */
  resultPage: ResultPageSettings;
  /** Every library file the sent content refers to, by id. A missing id is a file since deleted. */
  media: Record<string, PlayerMedia>;
};

/** `POST /me/activities/:id/answers` — one journey answer; null skips an optional question. */
export type JourneyAnswerInput = { questionId: string; value: ActivityAnswerValue | null };

export type JourneyAnswerOutcome = {
  /** `already_answered`: the same answer arrived before — nothing was written or paid twice. */
  status: 'recorded' | 'already_answered';
  /** What this answer added to the ledger, by reason; all zero on a repeat. */
  xpAwarded: { question: number; day: number; journey: number };
  dayCompleted: boolean;
  journeyCompleted: boolean;
  xpTotal: number;
  /** The journey after this answer. */
  journey: PlayerJourney;
  /** The files its result shows, once there is one — the page did not have them. */
  media: Record<string, PlayerMedia>;
};

/** `POST /me/activities/:id/submit`. */
export type ActivitySubmission = {
  status: Extract<ParticipationStatus, 'completed' | 'pending_review'>;
  /** What this submission actually added to the ledger — 0 when nothing was granted. */
  xpAwarded: number;
  /** The person's XP after it. */
  xpTotal: number;
  result: AssessmentResult | null;
  /** The answers revealed, when this submission was the person's last and the admin allows it. */
  answerReview: AnswerReview[] | null;
  /** A competition: where this submission stands now. */
  rank: LeaderboardEntry | null;
};

/** One question of a knowledge quiz, after the fact: what was right and why. */
export type AnswerReview = {
  questionId: string;
  /** Whether the person's answer was right. */
  correct: boolean;
  /** A matching question: the right match id for each prompt, in the prompts' order. */
  correctOptionIds: string[];
  explanation: string;
};

/** One place on a competition's leaderboard. */
export type LeaderboardEntry = {
  rank: number;
  /** `@username`, else the person's first name — never a phone number. */
  name: string;
  score: number;
  /** From starting to submitting; null when the start was not recorded. */
  durationMs: number | null;
  /** This is the person asking. */
  me: boolean;
};

/** `GET /me/activities/:id/leaderboard`. */
export type Leaderboard = {
  entries: LeaderboardEntry[];
  /** The person's own place, when they took part — also when it is below the list. */
  me: LeaderboardEntry | null;
  /** Everyone ranked. */
  total: number;
  /** The competition has ended; the ranking is final. */
  final: boolean;
};

/** `GET /admin/engagement/activities/:id/leaderboard` — with each person's full name, for the panel. */
export type AdminLeaderboardEntry = Omit<LeaderboardEntry, 'me'> & { userId: string; fullName: string };

/**
 * `GET /admin/engagement/activities/:id/preview` — a journey as the player
 * would get it, every day open and nothing answered, with the full
 * definition so the preview can simulate answers and results. Nothing the
 * preview does is sent back: no answer, no XP.
 */
export type JourneyPreview = { activity: PlayerActivity; definition: ActivityDefinition };

/** The stable `code` values both apps switch on. */
export const ENGAGEMENT_ERROR_CODES = {
  ACTIVITY_CLOSED: 'ACTIVITY_CLOSED',
  ACTIVITY_LIMIT_REACHED: 'ACTIVITY_LIMIT_REACHED',
  ACTIVITY_PENDING_REVIEW: 'ACTIVITY_PENDING_REVIEW',
  ACTIVITY_VERSION_CHANGED: 'ACTIVITY_VERSION_CHANGED',
  ACTIVITY_INVALID_TRANSITION: 'ACTIVITY_INVALID_TRANSITION',
  ACTIVITY_ARCHIVED: 'ACTIVITY_ARCHIVED',
  ACTIVITY_HAS_XP: 'ACTIVITY_HAS_XP',
  SUBMISSION_ALREADY_REVIEWED: 'SUBMISSION_ALREADY_REVIEWED',
  XP_ALREADY_REVOKED: 'XP_ALREADY_REVOKED',
  JOURNEY_DAY_LOCKED: 'JOURNEY_DAY_LOCKED',
  JOURNEY_ALREADY_ANSWERED: 'JOURNEY_ALREADY_ANSWERED',
  JOURNEY_ANSWER_ONLY: 'JOURNEY_ANSWER_ONLY',
} as const;
