import {
  QUESTIONNAIRE_ORDER,
  QUESTIONNAIRE_SCORING_VERSION,
  QUESTIONS,
  type QuestionId,
  type SectionId,
} from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers } from '@hamdastan/types';

/**
 * The questionnaire's scoring — `social-matching-v1`.
 *
 * One pure function, `computeProfile`, from the raw answers to the whole
 * internal profile. It is the only way a profile is ever produced: nothing is
 * accumulated across requests, so changing an answer cannot leave the old
 * answer's points behind, and the same answers always give the same profile.
 * That is also what makes a new scoring version a recompute rather than a
 * re-ask.
 *
 * The weights below are the spec's. Where the brief left a choice open, the
 * choice is written down beside the code that makes it and listed in
 * `docs/PRD.md` §4.2 — change it here and bump `QUESTIONNAIRE_SCORING_VERSION`.
 */

export const DIMENSIONS = [
  'SI', 'SE', 'CD', 'AO', 'SP', 'CP', 'CO', 'NV', 'ST', 'FL', 'SO', 'BP', 'PU', 'WU',
] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** Fixed order — it is also the tie-break, so the primary role is deterministic. */
export const ROLES = [
  'INITIATOR', 'FACILITATOR', 'ENERGIZER', 'ORGANIZER', 'LISTENER', 'ANALYST', 'IDEATOR',
] as const;
export type Role = (typeof ROLES)[number];

export type GroupSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'XL';

/** What one answer adds, keyed as the spec names it. Categorical answers carry their category. */
export type Contribution = Record<string, number | boolean | string>;

export type Availability = {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
  weekend: boolean;
};

export type SocialProfile = {
  scoringVersion: string;
  rawScoreContributions: Partial<Record<QuestionId, Contribution>>;
  /** The inputs to each normalisation, before it. */
  rawDimensions: Record<string, number>;
  /** Role-engine inputs that are not profile dimensions, 0–10. */
  normalizedSignals: { LISTENING?: number; DEBATE?: number };
  /** 1–10; null until the questions that feed one are answered. */
  dimensions: Record<Dimension, number | null>;
  motivationProfile: { ranked: string[]; scores: Record<string, number> } | null;
  conversationPreferences: Record<string, number> | null;
  preferredGroupSize: GroupSize | null;
  availability: Availability | null;
  conflictSensitivities: string[] | null;
  /** All seven, 0–10. Null until every question is answered. */
  roleScores: Record<Role, number> | null;
  primaryRole: Role | null;
  secondaryRole: Role | null;
};

export type ResumePoint = {
  currentQuestionId: QuestionId | null;
  currentSection: SectionId | null;
  progress: number;
};

// ─── Weights (spec) ──────────────────────────────────────────────────────────

const Q2: Record<string, { SI: number; SE: number; LISTENING: number }> = {
  INITIATES: { SI: 4, SE: 2, LISTENING: 0 },
  JOINS_EASILY: { SI: 2, SE: 2, LISTENING: 1 },
  OBSERVES_FIRST: { SI: 1, SE: 1, LISTENING: 2 },
  LISTENER: { SI: 0, SE: 0, LISTENING: 4 },
};

/** Each role picked in Q3 is +3 to that role. */
const Q3_POINTS = 3;

const Q5_WU: Record<string, number> = {
  MINUTES: 10,
  HALF_HOUR: 7,
  ONE_TWO_HOURS: 4,
  SEVERAL_MEETINGS: 1,
};

/** Every conversation type picked is +3 to that type; two also deepen CD. */
const Q6_POINTS = 3;
const Q6_CD: Record<string, number> = { DEEP: 2, STORY: 1 };

const Q7: Record<string, { CD: number; LISTENING: number; DEBATE: number }> = {
  ASKS_LISTENS: { CD: 1, LISTENING: 4, DEBATE: 0 },
  SHARES_STORIES: { CD: 2, LISTENING: 0, DEBATE: 0 },
  DEBATES: { CD: 3, LISTENING: 1, DEBATE: 4 },
  CALM: { CD: 1, LISTENING: 2, DEBATE: -2 },
};

const Q10_ST: Record<string, number> = { DETAILED: 9, FLEXIBLE: 6, SPONTANEOUS: 2 };

const Q12: Record<string, { CO: number; CP_SUPPORT: number }> = {
  COOPERATIVE: { CO: 10, CP_SUPPORT: 2 },
  FRIENDLY_COMPETITION: { CO: 8, CP_SUPPORT: 6 },
  SERIOUS_COMPETITION: { CO: 5, CP_SUPPORT: 9 },
};

const CP_BASE_WEIGHT = 0.65;
const CP_SUPPORT_WEIGHT = 0.35;

const Q13_NV: Record<string, number> = { FAMILIAR: 2, MIXED: 6, NEW: 10 };
const Q14_FL: Record<string, number> = { GOES_ALONG: 10, IF_GOOD_REASON: 7, OWN_CHOICE: 3 };
const Q18_SO: Record<string, number> = { SIMILAR: 2, MIXED: 6, ANY: 8 };

/** Q1: the first-ranked motivation is worth 3, then 2, then 1. */
const RANK_WEIGHTS = [3, 2, 1];

/** A secondary role must reach this share of the primary's score. */
const SECONDARY_ROLE_THRESHOLD = 0.7;

/**
 * The highest raw score each accumulated dimension can reach, for
 * `raw / max × 10`. Derived from the weights above:
 *   SI         Q2 only                            4
 *   CD         Q6 (DEEP 2 + STORY 1) + Q7 (max 3) 6
 *   LISTENING  Q2 (4) + Q7 (4)                    8
 *   DEBATE     Q7 only                            4  (its −2 floors at 0)
 */
const RAW_MAX = { SI: 4, CD: 6, LISTENING: 8, DEBATE: 4 } as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** `raw / max × 10`, held to 0–10. For internal signals. */
const toTen = (raw: number, max: number) => round2(clamp((raw / max) * 10, 0, 10));

/**
 * A profile dimension: the same normalisation, held to the profile's 1–10
 * scale. A raw score of 0 is therefore 1, the bottom of the scale.
 */
const toDimension = (raw: number, max: number) => round2(clamp((raw / max) * 10, 1, 10));

const mean = (values: number[]) => round2(values.reduce((a, b) => a + b, 0) / values.length);

// Stored answers have passed `questionnaireAnswerSchema`. These still check
// the shape, so a row from an older questionnaire version reads as missing
// rather than as garbage.
function single(answer: QuestionnaireAnswer | undefined): string | null {
  return answer && 'option' in answer ? answer.option : null;
}
function multi(answer: QuestionnaireAnswer | undefined): string[] | null {
  return answer && 'options' in answer ? answer.options : null;
}
function ranked(answer: QuestionnaireAnswer | undefined): string[] | null {
  return answer && 'ranked' in answer ? answer.ranked : null;
}
function slider(answer: QuestionnaireAnswer | undefined): number | null {
  return answer && 'value' in answer ? answer.value : null;
}

// ─── The engine ──────────────────────────────────────────────────────────────

export function computeProfile(answers: QuestionnaireAnswers): SocialProfile {
  const contributions: Partial<Record<QuestionId, Contribution>> = {};
  const raw: Record<string, number> = {};
  const dimensions = Object.fromEntries(DIMENSIONS.map((d) => [d, null])) as Record<
    Dimension,
    number | null
  >;

  // Q2 — entering a new group.
  const q2 = single(answers.Q2);
  const q2Points = q2 ? Q2[q2] : undefined;
  if (q2Points) {
    contributions.Q2 = { ...q2Points };
    raw.SI = q2Points.SI;
    raw.SE_Q2 = q2Points.SE;
    dimensions.SI = toDimension(q2Points.SI, RAW_MAX.SI);
  }

  // Q4 — social energy. Already 1–10, so used as it is. Q2's SE contribution
  // is kept in the raw data above but not mixed in: the brief defines SE as
  // the slider value and forbids normalising it again.
  const q4 = slider(answers.Q4);
  if (q4 !== null) {
    contributions.Q4 = { SE: q4 };
    raw.SE = q4;
    dimensions.SE = q4;
  }

  // Q5 — warm-up speed.
  const q5 = single(answers.Q5);
  if (q5 && q5 in Q5_WU) {
    contributions.Q5 = { WU: Q5_WU[q5] };
    dimensions.WU = Q5_WU[q5];
  }

  // Q19 — group size. Categorical; never a number.
  const q19 = single(answers.Q19) as GroupSize | null;
  if (q19) contributions.Q19 = { PREFERRED_GROUP_SIZE: q19 };

  // Q3 — natural roles.
  const q3 = multi(answers.Q3);
  if (q3) contributions.Q3 = Object.fromEntries(q3.map((role) => [role, Q3_POINTS]));

  // Q6 — conversation types, and the depth two of them add.
  const q6 = multi(answers.Q6);
  let q6Cd = 0;
  if (q6) {
    q6Cd = q6.reduce((sum, type) => sum + (Q6_CD[type] ?? 0), 0);
    contributions.Q6 = {
      ...Object.fromEntries(q6.map((type) => [type, Q6_POINTS])),
      CD: q6Cd,
    };
  }

  // Q7 — conversation behaviour.
  const q7 = single(answers.Q7);
  const q7Points = q7 ? Q7[q7] : undefined;
  if (q7Points) contributions.Q7 = { ...q7Points };

  // CD accumulates across Q6 and Q7, so it waits for both.
  if (q6 && q7Points) {
    raw.CD = q6Cd + q7Points.CD;
    dimensions.CD = toDimension(raw.CD, RAW_MAX.CD);
  }

  // Q18 — similarity or variety.
  const q18 = single(answers.Q18);
  if (q18 && q18 in Q18_SO) {
    contributions.Q18 = { SO: Q18_SO[q18] };
    dimensions.SO = Q18_SO[q18];
  }

  // Q20 — conflict sensitivities. Penalty triggers, not scores.
  const q20 = multi(answers.Q20);
  if (q20) contributions.Q20 = Object.fromEntries(q20.map((code) => [code, true]));

  // Q1 — motivations, by rank.
  const q1 = ranked(answers.Q1);
  if (q1) contributions.Q1 = Object.fromEntries(q1.map((code, i) => [code, RANK_WEIGHTS[i]]));

  // Section 3 — direct sliders.
  const q8 = slider(answers.Q8);
  if (q8 !== null) {
    contributions.Q8 = { SP: q8 };
    dimensions.SP = q8;
  }
  const q9 = slider(answers.Q9);
  if (q9 !== null) {
    contributions.Q9 = { AO: q9 };
    dimensions.AO = q9;
  }
  const q11 = slider(answers.Q11);
  if (q11 !== null) {
    contributions.Q11 = { CP_BASE: q11 };
    raw.CP_BASE = q11;
  }

  // Q12 — cooperation, and the competitive half of CP.
  const q12 = single(answers.Q12);
  const q12Points = q12 ? Q12[q12] : undefined;
  if (q12Points) {
    contributions.Q12 = { ...q12Points };
    raw.CP_SUPPORT = q12Points.CP_SUPPORT;
    dimensions.CO = q12Points.CO;
  }
  if (q11 !== null && q12Points) {
    dimensions.CP = round2(q11 * CP_BASE_WEIGHT + q12Points.CP_SUPPORT * CP_SUPPORT_WEIGHT);
  }

  const q13 = single(answers.Q13);
  if (q13 && q13 in Q13_NV) {
    contributions.Q13 = { NV: Q13_NV[q13] };
    dimensions.NV = Q13_NV[q13];
  }

  // Section 4.
  const q10 = single(answers.Q10);
  if (q10 && q10 in Q10_ST) {
    contributions.Q10 = { ST: Q10_ST[q10] };
    dimensions.ST = Q10_ST[q10];
  }
  const q14 = single(answers.Q14);
  if (q14 && q14 in Q14_FL) {
    contributions.Q14 = { FL: Q14_FL[q14] };
    dimensions.FL = Q14_FL[q14];
  }

  // Q15 — availability. A matching constraint, not a score.
  const q15 = multi(answers.Q15);
  const availability: Availability | null = q15
    ? {
        morning: q15.includes('MORNING'),
        afternoon: q15.includes('AFTERNOON'),
        evening: q15.includes('EVENING'),
        weekend: q15.includes('WEEKEND'),
      }
    : null;
  if (availability) {
    contributions.Q15 = {
      MORNING: availability.morning,
      AFTERNOON: availability.afternoon,
      EVENING: availability.evening,
      WEEKEND: availability.weekend,
    };
  }

  const q16 = slider(answers.Q16);
  if (q16 !== null) {
    contributions.Q16 = { BP: q16 };
    dimensions.BP = q16;
  }
  const q17 = slider(answers.Q17);
  if (q17 !== null) {
    contributions.Q17 = { PU: q17 };
    dimensions.PU = q17;
  }

  // Internal signals.
  const normalizedSignals: SocialProfile['normalizedSignals'] = {};
  if (q2Points && q7Points) {
    raw.LISTENING = q2Points.LISTENING + q7Points.LISTENING;
    normalizedSignals.LISTENING = toTen(raw.LISTENING, RAW_MAX.LISTENING);
  }
  if (q7Points) {
    raw.DEBATE = q7Points.DEBATE;
    normalizedSignals.DEBATE = toTen(raw.DEBATE, RAW_MAX.DEBATE);
  }

  const roleScores = isComplete(answers)
    ? scoreRoles({
        q2: q2Points!,
        q3: q3!,
        q6: q6!,
        q7: q7Points!,
        dimensions: dimensions as Record<Dimension, number>,
        listening: normalizedSignals.LISTENING!,
        debate: normalizedSignals.DEBATE!,
        q6Cd,
      })
    : null;
  const { primaryRole, secondaryRole } = pickRoles(roleScores);

  return {
    scoringVersion: QUESTIONNAIRE_SCORING_VERSION,
    rawScoreContributions: contributions,
    rawDimensions: raw,
    normalizedSignals,
    dimensions,
    motivationProfile: q1
      ? { ranked: q1, scores: contributions.Q1 as Record<string, number> }
      : null,
    conversationPreferences: q6
      ? Object.fromEntries(q6.map((type) => [type, Q6_POINTS]))
      : null,
    preferredGroupSize: q19,
    availability,
    conflictSensitivities: q20,
    roleScores,
    primaryRole,
    secondaryRole,
  };
}

/**
 * The role engine. Each role is the mean of its signals, every signal on
 * 0–10: a Q3 pick is its +3 normalised (picked = 10, not = 0), and the
 * dimensions and signals are used as computed above. Equal weights are the
 * v1 choice; the spec names the signals but not their weights.
 */
function scoreRoles(input: {
  q2: { SI: number; LISTENING: number };
  q3: string[];
  q6: string[];
  q7: { LISTENING: number };
  dimensions: Record<Dimension, number>;
  listening: number;
  debate: number;
  q6Cd: number;
}): Record<Role, number> {
  const { q2, q3, q6, q7, dimensions: d, listening, debate, q6Cd } = input;
  const picked = (role: Role) => (q3.includes(role) ? 10 : 0);
  // Q6's depth contribution (DEEP 2 + STORY 1), on 0–10.
  const q6Depth = toTen(q6Cd, 3);
  const deepOrInterest = (q6.includes('DEEP') ? 5 : 0) + (q6.includes('INTEREST') ? 5 : 0);

  return {
    INITIATOR: mean([toTen(q2.SI, 4), picked('INITIATOR')]),
    FACILITATOR: mean([picked('FACILITATOR'), d.CO, listening]),
    ENERGIZER: mean([picked('ENERGIZER'), d.SE, d.SP]),
    ORGANIZER: mean([picked('ORGANIZER'), d.ST, d.PU]),
    LISTENER: mean([toTen(q2.LISTENING, 4), picked('LISTENER'), toTen(q7.LISTENING, 4)]),
    ANALYST: mean([picked('ANALYST'), q6Depth, debate]),
    IDEATOR: mean([picked('IDEATOR'), d.NV, deepOrInterest]),
  };
}

/** Highest wins, ties to the earlier role in `ROLES`; second only within 70%. */
export function pickRoles(scores: Record<Role, number> | null): {
  primaryRole: Role | null;
  secondaryRole: Role | null;
} {
  if (!scores) return { primaryRole: null, secondaryRole: null };

  const ranked = [...ROLES].sort((a, b) => scores[b] - scores[a] || ROLES.indexOf(a) - ROLES.indexOf(b));
  const [first, second] = ranked;
  const primary = scores[first];

  return {
    primaryRole: first,
    secondaryRole:
      primary > 0 && scores[second] >= primary * SECONDARY_ROLE_THRESHOLD ? second : null,
  };
}

export function isComplete(answers: QuestionnaireAnswers): boolean {
  return QUESTIONNAIRE_ORDER.every((id) => answers[id] !== undefined);
}

/** The first unanswered question in presentation order, and how far along that is. */
export function resumePoint(answers: QuestionnaireAnswers): ResumePoint {
  const answered = QUESTIONNAIRE_ORDER.filter((id) => answers[id] !== undefined).length;
  const next = QUESTIONNAIRE_ORDER.find((id) => answers[id] === undefined) ?? null;

  return {
    currentQuestionId: next,
    currentSection: next ? QUESTIONS[next].section : null,
    progress: Math.round((answered / QUESTIONNAIRE_ORDER.length) * 100),
  };
}
