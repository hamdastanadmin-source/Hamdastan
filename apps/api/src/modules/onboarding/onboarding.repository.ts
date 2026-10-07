import type { QuestionId, SectionId } from '@hamdastan/config';
import type { QuestionnaireAnswer, QuestionnaireAnswers } from '@hamdastan/types';

import { query, queryOne, withTransaction } from '../../data';
import { createRepositorySlot } from '../../shared/repository';

import type {
  AnswerToSave,
  DerivedQuestionnaire,
  OnboardingEventRecord,
  QuestionnaireRecord,
} from './onboarding.types';

/**
 * Data access port for the Onboarding module, and the PostgreSQL adapter
 * that satisfies it.
 *
 * The raw answers are the source of truth; the profile row is derived from
 * them. `saveAnswer` therefore takes the derivation as a function and runs it
 * inside the same transaction as the write, against the full answer set it
 * has just read back — so the stored profile always describes exactly the
 * stored answers, even when two saves from the same person race.
 */
export interface OnboardingRepository {
  findQuestionnaire(userId: string): Promise<QuestionnaireRecord>;
  saveAnswer(
    userId: string,
    answer: AnswerToSave,
    derive: (answers: QuestionnaireAnswers) => DerivedQuestionnaire
  ): Promise<QuestionnaireRecord>;
  /** Marks the questionnaire finished and onboarding stage 2 done, together. */
  markCompleted(userId: string): Promise<void>;
  recordEvent(userId: string, event: OnboardingEventRecord): Promise<void>;
}

const slot = createRepositorySlot<OnboardingRepository>('onboarding');

/** The bound implementation. Throws 501 until a data layer registers one. */
export const onboardingRepository = slot.get;

/** Binds the data layer's implementation. Called once, at boot. */
export const setOnboardingRepository = slot.set;

// ─── PostgreSQL adapter ──────────────────────────────────────────────────────

type AnswerRow = { question_id: QuestionId; answer: QuestionnaireAnswer };

const toAnswers = (rows: AnswerRow[]): QuestionnaireAnswers =>
  Object.fromEntries(rows.map((row) => [row.question_id, row.answer]));

/** Column order of the profile upsert; `$1` is the user id. */
function profileParams(userId: string, p: DerivedQuestionnaire): unknown[] {
  const d = p.dimensions;
  return [
    userId,
    p.scoringVersion,
    p.currentQuestionId,
    p.currentSection satisfies SectionId | null,
    p.progress,
    JSON.stringify(p.rawScoreContributions),
    JSON.stringify(p.rawDimensions),
    JSON.stringify(p.normalizedSignals),
    d.SI, d.SE, d.CD, d.AO, d.SP, d.CP, d.CO, d.NV, d.ST, d.FL, d.SO, d.BP, d.PU, d.WU,
    p.motivationProfile && JSON.stringify(p.motivationProfile),
    p.conversationPreferences && JSON.stringify(p.conversationPreferences),
    p.preferredGroupSize,
    p.availability?.morning ?? null,
    p.availability?.afternoon ?? null,
    p.availability?.evening ?? null,
    p.availability?.weekend ?? null,
    p.conflictSensitivities,
    p.roleScores && JSON.stringify(p.roleScores),
    p.primaryRole,
    p.secondaryRole,
  ];
}

/**
 * Every derived column, rewritten whole. `questionnaire_completed` is not in
 * the list: editing an answer after finishing recomputes the profile but does
 * not un-finish the questionnaire.
 */
const UPSERT_PROFILE = `
  INSERT INTO v2_social_profiles (
    user_id, scoring_version, current_question_id, current_section, progress,
    raw_score_contributions, raw_dimensions, normalized_signals,
    si, se, cd, ao, sp, cp, co, nv, st, fl, so, bp, pu, wu,
    motivation_profile, conversation_preferences, preferred_group_size,
    available_morning, available_afternoon, available_evening, available_weekend,
    conflict_sensitivities, role_scores, primary_role, secondary_role
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
    $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
  )
  ON CONFLICT (user_id) DO UPDATE SET
    scoring_version          = EXCLUDED.scoring_version,
    current_question_id      = EXCLUDED.current_question_id,
    current_section          = EXCLUDED.current_section,
    progress                 = EXCLUDED.progress,
    raw_score_contributions  = EXCLUDED.raw_score_contributions,
    raw_dimensions           = EXCLUDED.raw_dimensions,
    normalized_signals       = EXCLUDED.normalized_signals,
    si = EXCLUDED.si, se = EXCLUDED.se, cd = EXCLUDED.cd, ao = EXCLUDED.ao,
    sp = EXCLUDED.sp, cp = EXCLUDED.cp, co = EXCLUDED.co, nv = EXCLUDED.nv,
    st = EXCLUDED.st, fl = EXCLUDED.fl, so = EXCLUDED.so, bp = EXCLUDED.bp,
    pu = EXCLUDED.pu, wu = EXCLUDED.wu,
    motivation_profile       = EXCLUDED.motivation_profile,
    conversation_preferences = EXCLUDED.conversation_preferences,
    preferred_group_size     = EXCLUDED.preferred_group_size,
    available_morning        = EXCLUDED.available_morning,
    available_afternoon      = EXCLUDED.available_afternoon,
    available_evening        = EXCLUDED.available_evening,
    available_weekend        = EXCLUDED.available_weekend,
    conflict_sensitivities   = EXCLUDED.conflict_sensitivities,
    role_scores              = EXCLUDED.role_scores,
    primary_role             = EXCLUDED.primary_role,
    secondary_role           = EXCLUDED.secondary_role,
    updated_at               = now()
  RETURNING questionnaire_completed
`;

export const sqlOnboardingRepository: OnboardingRepository = {
  async findQuestionnaire(userId) {
    const [rows, profile] = await Promise.all([
      query<AnswerRow>(
        `SELECT question_id, answer FROM v2_questionnaire_answers WHERE user_id = $1`,
        [userId]
      ),
      queryOne<{ questionnaire_completed: boolean }>(
        `SELECT questionnaire_completed FROM v2_social_profiles WHERE user_id = $1`,
        [userId]
      ),
    ]);
    return { answers: toAnswers(rows), completed: profile?.questionnaire_completed ?? false };
  },

  async saveAnswer(userId, { questionId, answer, presentationIndex }, derive) {
    return withTransaction(async (client) => {
      // One person's saves run one at a time, so the profile written below is
      // derived from the answers as they stand after *this* write.
      await client.query(`SELECT 1 FROM v2_users WHERE id = $1 FOR UPDATE`, [userId]);

      // An edit replaces the answer; `answered_at` keeps the first time.
      //
      // The write and the read-back are one statement. Every part of a
      // statement sees the same snapshot, so the SELECT below would see the
      // row as it was *before* the upsert: it skips that question and the
      // upsert's own RETURNING supplies it instead.
      const { rows } = await client.query<AnswerRow>(
        `WITH saved AS (
           INSERT INTO v2_questionnaire_answers (user_id, question_id, answer, presentation_index)
                VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, question_id) DO UPDATE
                 SET answer             = EXCLUDED.answer,
                     presentation_index = EXCLUDED.presentation_index,
                     updated_at         = now()
           RETURNING question_id, answer
         )
         SELECT question_id, answer FROM saved
         UNION ALL
         SELECT question_id, answer FROM v2_questionnaire_answers
          WHERE user_id = $1 AND question_id <> $2`,
        [userId, questionId, JSON.stringify(answer), presentationIndex]
      );
      const answers = toAnswers(rows);

      const profile = await client.query<{ questionnaire_completed: boolean }>(
        UPSERT_PROFILE,
        profileParams(userId, derive(answers))
      );

      return { answers, completed: profile.rows[0].questionnaire_completed };
    });
  },

  async markCompleted(userId) {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE v2_social_profiles
            SET questionnaire_completed    = true,
                questionnaire_completed_at = COALESCE(questionnaire_completed_at, now()),
                updated_at                 = now()
          WHERE user_id = $1`,
        [userId]
      );
      // GREATEST: like stage 1, finishing stage 2 never moves progress back.
      await client.query(
        `UPDATE v2_users
            SET onboarding_stage = GREATEST(onboarding_stage, 2), updated_at = now()
          WHERE id = $1`,
        [userId]
      );
    });
  },

  async recordEvent(userId, e) {
    await query(
      `INSERT INTO v2_onboarding_events
              (user_id, event, question_id, presentation_index, section_id, properties)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, e.event, e.questionId, e.presentationIndex, e.sectionId, JSON.stringify(e.properties)]
    );
  },
};
