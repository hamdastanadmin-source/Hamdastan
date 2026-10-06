import { describe, expect, it } from 'vitest';

import { QUESTIONNAIRE_ORDER, QUESTIONS } from '@hamdastan/config';
import type { QuestionnaireAnswers } from '@hamdastan/types';
import { questionnaireAnswerSchema } from '@hamdastan/validation';

import {
  buildResult,
  computeProfile,
  deriveQuestionnaire,
  pickRoles,
  resumePoint,
} from '../modules/onboarding';

/**
 * The scoring spec, item by item. Pure functions, no database: these run on
 * every `npm test`.
 */

const BASE: QuestionnaireAnswers = {
  Q1: { ranked: ['SOCIAL', 'FUN', 'DISCOVERY'] },
  Q2: { option: 'INITIATES' },
  Q3: { options: ['INITIATOR', 'ENERGIZER'] },
  Q4: { value: 8 },
  Q5: { option: 'MINUTES' },
  Q6: { options: ['DEEP', 'STORY', 'LIGHT'] },
  Q7: { option: 'DEBATES' },
  Q8: { value: 7 },
  Q9: { value: 4 },
  Q10: { option: 'FLEXIBLE' },
  Q11: { value: 5 },
  Q12: { option: 'FRIENDLY_COMPETITION' },
  Q13: { option: 'NEW' },
  Q14: { option: 'GOES_ALONG' },
  Q15: { options: ['EVENING', 'WEEKEND'] },
  Q16: { value: 6 },
  Q17: { value: 9 },
  Q18: { option: 'MIXED' },
  Q19: { option: 'MEDIUM' },
  Q20: { options: ['HIGH_CP', 'LOW_ST_LOW_PU'] },
};

const withAnswer = (patch: QuestionnaireAnswers): QuestionnaireAnswers => ({ ...BASE, ...patch });
const dims = (answers: QuestionnaireAnswers) => computeProfile(answers).dimensions;
const contrib = (answers: QuestionnaireAnswers) => computeProfile(answers).rawScoreContributions;

describe('the base answer set is valid', () => {
  it('passes every question schema', () => {
    for (const id of QUESTIONNAIRE_ORDER) {
      expect(questionnaireAnswerSchema(id).safeParse({ answer: BASE[id] }).success, id).toBe(true);
    }
  });
});

describe('scoring, question by question', () => {
  it('Q1: ranks weigh 3 / 2 / 1', () => {
    const profile = computeProfile(BASE);
    expect(profile.motivationProfile).toEqual({
      ranked: ['SOCIAL', 'FUN', 'DISCOVERY'],
      scores: { SOCIAL: 3, FUN: 2, DISCOVERY: 1 },
    });
    expect(
      computeProfile(withAnswer({ Q1: { ranked: ['NETWORKING'] } })).motivationProfile?.scores
    ).toEqual({ NETWORKING: 3 });
  });

  it.each([
    ['INITIATES', { SI: 4, SE: 2, LISTENING: 0 }],
    ['JOINS_EASILY', { SI: 2, SE: 2, LISTENING: 1 }],
    ['OBSERVES_FIRST', { SI: 1, SE: 1, LISTENING: 2 }],
    ['LISTENER', { SI: 0, SE: 0, LISTENING: 4 }],
  ])('Q2: %s contributes %o', (option, expected) => {
    expect(contrib(withAnswer({ Q2: { option } })).Q2).toEqual(expected);
  });

  it('Q2: SI is normalised against its maximum of 4', () => {
    expect(dims(withAnswer({ Q2: { option: 'INITIATES' } })).SI).toBe(10);
    expect(dims(withAnswer({ Q2: { option: 'JOINS_EASILY' } })).SI).toBe(5);
    // 0 / 4 × 10 is 0, held to the bottom of the 1–10 scale.
    expect(dims(withAnswer({ Q2: { option: 'LISTENER' } })).SI).toBe(1);
  });

  it('Q3: each selected role is +3', () => {
    expect(contrib(BASE).Q3).toEqual({ INITIATOR: 3, ENERGIZER: 3 });
  });

  it('Q4: SE is the slider value, not normalised again', () => {
    for (const value of [1, 5, 10]) expect(dims(withAnswer({ Q4: { value } })).SE).toBe(value);
  });

  it.each([
    ['MINUTES', 10],
    ['HALF_HOUR', 7],
    ['ONE_TWO_HOURS', 4],
    ['SEVERAL_MEETINGS', 1],
  ])('Q5: %s → WU %i', (option, wu) => {
    expect(dims(withAnswer({ Q5: { option } })).WU).toBe(wu);
  });

  it('Q6: categories +3 each; DEEP adds CD 2 and STORY CD 1', () => {
    const profile = computeProfile(BASE);
    expect(profile.conversationPreferences).toEqual({ DEEP: 3, STORY: 3, LIGHT: 3 });
    expect(profile.rawScoreContributions.Q6).toEqual({ DEEP: 3, STORY: 3, LIGHT: 3, CD: 3 });
  });

  it.each([
    ['ASKS_LISTENS', { CD: 1, LISTENING: 4, DEBATE: 0 }],
    ['SHARES_STORIES', { CD: 2, LISTENING: 0, DEBATE: 0 }],
    ['DEBATES', { CD: 3, LISTENING: 1, DEBATE: 4 }],
    ['CALM', { CD: 1, LISTENING: 2, DEBATE: -2 }],
  ])('Q7: %s contributes %o', (option, expected) => {
    expect(contrib(withAnswer({ Q7: { option } })).Q7).toEqual(expected);
  });

  it('CD accumulates Q6 and Q7 against a maximum of 6', () => {
    // Q6 DEEP+STORY = 3, Q7 DEBATES = 3 → 6 / 6 × 10.
    expect(dims(BASE).CD).toBe(10);
    // Q6 LIGHT = 0, Q7 CALM = 1 → 1 / 6 × 10.
    expect(dims(withAnswer({ Q6: { options: ['LIGHT'] }, Q7: { option: 'CALM' } })).CD).toBe(1.67);
  });

  it('Q8, Q9, Q16, Q17: SP, AO, BP, PU are the slider values', () => {
    const d = dims(BASE);
    expect([d.SP, d.AO, d.BP, d.PU]).toEqual([7, 4, 6, 9]);
  });

  it.each([
    ['DETAILED', 9],
    ['FLEXIBLE', 6],
    ['SPONTANEOUS', 2],
  ])('Q10: %s → ST %i', (option, st) => {
    expect(dims(withAnswer({ Q10: { option } })).ST).toBe(st);
  });

  it('Q11 and Q12: CP = 0.65 × CP_base + 0.35 × CP_support, with both parts kept', () => {
    const profile = computeProfile(BASE);
    expect(profile.rawDimensions.CP_BASE).toBe(5);
    expect(profile.rawDimensions.CP_SUPPORT).toBe(6);
    expect(profile.dimensions.CP).toBe(5.35);
  });

  it.each([
    ['COOPERATIVE', 10, 2],
    ['FRIENDLY_COMPETITION', 8, 6],
    ['SERIOUS_COMPETITION', 5, 9],
  ])('Q12: %s → CO %i, CP_support %i', (option, co, cpSupport) => {
    const profile = computeProfile(withAnswer({ Q12: { option }, Q11: { value: 10 } }));
    expect(profile.dimensions.CO).toBe(co);
    expect(profile.rawScoreContributions.Q12).toEqual({ CO: co, CP_SUPPORT: cpSupport });
    expect(profile.dimensions.CP).toBe(Math.round((10 * 0.65 + cpSupport * 0.35) * 100) / 100);
  });

  it.each([
    ['FAMILIAR', 2],
    ['MIXED', 6],
    ['NEW', 10],
  ])('Q13: %s → NV %i', (option, nv) => {
    expect(dims(withAnswer({ Q13: { option } })).NV).toBe(nv);
  });

  it.each([
    ['GOES_ALONG', 10],
    ['IF_GOOD_REASON', 7],
    ['OWN_CHOICE', 3],
  ])('Q14: %s → FL %i', (option, fl) => {
    expect(dims(withAnswer({ Q14: { option } })).FL).toBe(fl);
  });

  it('Q15: availability is four booleans, not a score', () => {
    expect(computeProfile(BASE).availability).toEqual({
      morning: false,
      afternoon: false,
      evening: true,
      weekend: true,
    });
  });

  it.each([
    ['SIMILAR', 2],
    ['MIXED', 6],
    ['ANY', 8],
  ])('Q18: %s → SO %i', (option, so) => {
    expect(dims(withAnswer({ Q18: { option } })).SO).toBe(so);
  });

  it.each(['SMALL', 'MEDIUM', 'LARGE', 'XL'])('Q19: %s is stored as the category', (option) => {
    expect(computeProfile(withAnswer({ Q19: { option } })).preferredGroupSize).toBe(option);
  });

  it('Q20: conflict sensitivities are kept as triggers', () => {
    const profile = computeProfile(BASE);
    expect(profile.conflictSensitivities).toEqual(['HIGH_CP', 'LOW_ST_LOW_PU']);
    for (const dimension of Object.values(profile.dimensions)) {
      expect(typeof dimension === 'number' || dimension === null).toBe(true);
    }
  });
});

describe('the role engine', () => {
  it('keeps all seven scores and picks the highest as primary', () => {
    const profile = computeProfile(BASE);
    const scores = profile.roleScores!;
    expect(Object.keys(scores)).toHaveLength(7);
    const max = Math.max(...Object.values(scores));
    expect(scores[profile.primaryRole!]).toBe(max);
  });

  it('names a secondary role only at 70% of the primary or more', () => {
    const base = { INITIATOR: 0, FACILITATOR: 0, ENERGIZER: 0, ORGANIZER: 0, LISTENER: 0, ANALYST: 0, IDEATOR: 0 };
    expect(pickRoles({ ...base, ENERGIZER: 10, ANALYST: 7 })).toEqual({
      primaryRole: 'ENERGIZER',
      secondaryRole: 'ANALYST',
    });
    expect(pickRoles({ ...base, ENERGIZER: 10, ANALYST: 6.99 })).toEqual({
      primaryRole: 'ENERGIZER',
      secondaryRole: null,
    });
  });

  it('breaks ties by the fixed role order', () => {
    const tie = { INITIATOR: 5, FACILITATOR: 5, ENERGIZER: 5, ORGANIZER: 5, LISTENER: 5, ANALYST: 5, IDEATOR: 5 };
    expect(pickRoles(tie)).toEqual({ primaryRole: 'INITIATOR', secondaryRole: 'FACILITATOR' });
  });

  it('a listener profile leads with LISTENER', () => {
    const profile = computeProfile(
      withAnswer({
        Q2: { option: 'LISTENER' },
        Q3: { options: ['LISTENER'] },
        Q7: { option: 'ASKS_LISTENS' },
        Q4: { value: 3 },
        Q8: { value: 3 },
      })
    );
    expect(profile.primaryRole).toBe('LISTENER');
  });

  it('is not computed until every question is answered', () => {
    const partial = { ...BASE };
    delete partial.Q17;
    expect(computeProfile(partial).roleScores).toBeNull();
  });
});

describe('editing and recomputation', () => {
  it('replacing an answer replaces its contribution instead of stacking', () => {
    const edited = computeProfile(withAnswer({ Q2: { option: 'LISTENER' } }));
    const fresh = computeProfile({ ...BASE, Q2: { option: 'LISTENER' } });
    expect(edited).toEqual(fresh);
    expect(edited.rawScoreContributions.Q2).toEqual({ SI: 0, SE: 0, LISTENING: 4 });
  });

  it('the same answers always give the same profile', () => {
    const shuffled = Object.fromEntries(Object.entries(BASE).reverse()) as QuestionnaireAnswers;
    expect(computeProfile(shuffled)).toEqual(computeProfile(BASE));
    expect(buildResult(computeProfile(shuffled))).toEqual(buildResult(computeProfile(BASE)));
  });

  it('leaves a dimension null until its questions are answered', () => {
    const profile = computeProfile({ Q11: { value: 9 } });
    expect(profile.dimensions.CP).toBeNull();
    expect(profile.rawDimensions.CP_BASE).toBe(9);
  });
});

describe('resume', () => {
  it('points at the first unanswered question in presentation order, not by id', () => {
    expect(resumePoint({})).toEqual({ currentQuestionId: 'Q2', currentSection: 1, progress: 0 });
    expect(resumePoint({ Q2: BASE.Q2, Q4: BASE.Q4 })).toMatchObject({
      currentQuestionId: 'Q5',
      progress: 10,
    });
    expect(resumePoint(BASE)).toEqual({ currentQuestionId: null, currentSection: null, progress: 100 });
  });

  it('the presentation order covers each question once, in four sections of five', () => {
    expect(new Set(QUESTIONNAIRE_ORDER).size).toBe(20);
    for (const [i, id] of QUESTIONNAIRE_ORDER.entries()) {
      expect(QUESTIONS[id].section).toBe(Math.floor(i / 5) + 1);
    }
  });

  it('derives the stored row as profile plus resume point', () => {
    expect(deriveQuestionnaire(BASE)).toMatchObject({ progress: 100, currentQuestionId: null });
  });
});

describe('the result card', () => {
  it('is built from the strongest preferences', () => {
    const result = buildResult(
      computeProfile(withAnswer({ Q4: { value: 10 }, Q13: { option: 'NEW' }, Q8: { value: 5 } }))
    );
    expect(result.title).toBe('پرانرژی و کنجکاو');
    expect(result.dimensions.map((d) => d.key)).toEqual(['SE', 'NV', 'AO', 'CP', 'ST']);
  });

  it('joins opposite pulls with «ولی»', () => {
    const result = buildResult(
      computeProfile(
        withAnswer({
          Q4: { value: 1 },
          Q13: { option: 'NEW' },
          Q8: { value: 5 },
          Q9: { value: 5 },
          Q2: { option: 'JOINS_EASILY' },
          Q6: { options: ['LIGHT', 'STORY'] },
          Q7: { option: 'SHARES_STORIES' },
          Q10: { option: 'FLEXIBLE' },
          Q14: { option: 'IF_GOOD_REASON' },
        })
      )
    );
    expect(result.title).toBe('آروم ولی کنجکاو');
  });

  it('reads the profile back as three plain-language insights', () => {
    // BASE: SE 8, NV 10 (NEW), AO 4, ST 6 (FLEXIBLE).
    expect(buildResult(computeProfile(BASE)).insights).toEqual([
      { key: 'energy', label: 'بیشتر انرژی می‌گیری از', value: 'آدم‌ها و تعامل' },
      { key: 'seeking', label: 'توی تجربه‌ها دنبال', value: 'تازگی و گفتگو' },
      { key: 'structure', label: 'توی گروه ترجیح می‌دی', value: 'ساختار منعطف' },
    ]);
    const calm = buildResult(
      computeProfile(
        withAnswer({ Q4: { value: 2 }, Q13: { option: 'FAMILIAR' }, Q9: { value: 9 }, Q10: { option: 'DETAILED' } })
      )
    ).insights.map((insight) => insight.value);
    expect(calm).toEqual(['جمع‌های کوچیک و آروم', 'آشنایی و فعالیت', 'برنامه‌ی مشخص']);
  });

  it('explains the profile as one plain paragraph built from the same readings', () => {
    // BASE: SE 8, NV 10, AO 4, ST 6.
    expect(buildResult(computeProfile(BASE)).summary).toMatch(
      /^یعنی کنار آدم‌های تازه .*\. دنبال تجربه‌هایی هستی که تازگی و گفتگو توشون باشه و یه برنامه‌ی منعطف بیشتر بهت می‌چسبه\. پس /
    );
  });

  it('carries the stage-1 interests as labels, grouped in catalog order', () => {
    const { interests } = buildResult(computeProfile(BASE), ['photography', 'cafe', 'gone-id', 'concert']);
    expect(interests).toEqual([
      { key: 'music', title: 'موسیقی و اجرا', interests: ['کنسرت'] },
      { key: 'art', title: 'هنر و خلاقیت', interests: ['عکاسی'] },
      { key: 'lifestyle', title: 'تفریح و سبک زندگی', interests: ['کافه'] },
    ]);
  });

  it('names the primary role and picks its character by gender', () => {
    const profile = computeProfile(BASE);
    const key = profile.primaryRole!.toLowerCase();
    expect(buildResult(profile, [], 'female').role).toMatchObject({ key, avatarId: `${key}-female` });
    expect(buildResult(profile, [], 'male').role?.avatarId).toBe(`${key}-male`);
    expect(buildResult(profile).role).toMatchObject({ key, avatarId: null });
    expect(buildResult(profile).role?.label).toBeTruthy();
  });

  it('shows ST inverted on the planned-to-spontaneous bar', () => {
    const st = buildResult(computeProfile(withAnswer({ Q10: { option: 'DETAILED' } }))).dimensions.find(
      (d) => d.key === 'ST'
    );
    expect(st).toMatchObject({ value: 2, minLabel: 'برنامه‌ریزی', maxLabel: 'بداهه' });
  });
});
