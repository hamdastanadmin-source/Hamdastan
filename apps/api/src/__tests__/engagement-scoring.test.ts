import { describe, expect, it } from 'vitest';

import type { ActivityDefinition } from '@hamdastan/types';
import { activityInputSchema, validateAnswers } from '@hamdastan/validation';

import { earnsXp, scoreAssessment } from '../modules/engagement';

/**
 * The assessment engine, the XP rule and the shared answer checks as plain
 * functions — no database. The integration suite covers them through HTTP.
 */

const XP = { enabled: true, amount: 10, showBeforeStart: true, maxAwards: 1, requirePass: false };

const base: ActivityDefinition = {
  steps: [],
  estimatedMinutes: 3,
  maxSubmissions: 1,
  anonymous: false,
  review: 'auto',
  assessment: null,
  journey: null,
  xp: XP,
};

const matching = {
  id: 'pairs',
  kind: 'matching' as const,
  title: 'جفت کن',
  required: true,
  pairs: [1, 2, 3, 4].map((n) => ({ id: `p${n}`, prompt: `مورد ${n}`, matchId: `m${n}`, match: `جفت ${n}` })),
};

const personality: ActivityDefinition = {
  ...base,
  steps: [
    {
      id: 's',
      title: '',
      description: '',
      questions: [
        { id: 'a', kind: 'rating', title: 'a', required: true, max: 5, dimensionId: 'x' },
        { id: 'b', kind: 'rating', title: 'b', required: true, max: 5, dimensionId: 'x', reverse: true },
        {
          id: 'c',
          kind: 'single',
          title: 'c',
          required: true,
          dimensionId: 'y',
          options: [
            { id: 'lo', label: 'lo', score: 0 },
            { id: 'hi', label: 'hi', score: 4 },
          ],
        },
      ],
    },
  ],
  assessment: {
    mode: 'personality',
    dimensions: [
      { id: 'x', title: 'X', description: 'dx' },
      { id: 'y', title: 'Y', description: 'dy' },
    ],
    passingScore: null,
    showResult: true,
      revealAnswers: false,
  },
};

describe('scoreAssessment', () => {
  it('turns a reverse-keyed item round before averaging', () => {
    // a = 5 → 1.0; b = 1 reversed → 1.0; so X is 100.
    const result = scoreAssessment(personality, { a: 5, b: 1, c: 'lo' })!;
    expect(result.dimensions).toEqual([
      { id: 'x', title: 'X', value: 100 },
      { id: 'y', title: 'Y', value: 0 },
    ]);
    expect(result.outcome).toEqual({ title: 'X', description: 'dx' });
  });

  it('places a choice by its points between the question’s lowest and highest', () => {
    const result = scoreAssessment(personality, { a: 1, b: 5, c: 'hi' })!;
    expect(result.dimensions.find((d) => d.id === 'y')?.value).toBe(100);
    expect(result.outcome?.title).toBe('Y');
  });

  it('marks a multiple-choice knowledge question right only for exactly its correct options', () => {
    const quiz: ActivityDefinition = {
      ...base,
      steps: [
        {
          id: 's',
          title: '',
          description: '',
          questions: [
            {
              id: 'm',
              kind: 'multiple',
              title: 'm',
              required: true,
              options: [
                { id: '1', label: '1', correct: true },
                { id: '2', label: '2', correct: true },
                { id: '3', label: '3' },
              ],
            },
          ],
        },
      ],
      assessment: { mode: 'knowledge', dimensions: [], passingScore: 50, showResult: true, revealAnswers: false },
    };
    expect(scoreAssessment(quiz, { m: ['1', '2'] })).toMatchObject({ score: 100, passed: true });
    expect(scoreAssessment(quiz, { m: ['1'] })).toMatchObject({ score: 0, passed: false });
    expect(scoreAssessment(quiz, { m: ['1', '2', '3'] })).toMatchObject({ score: 0, passed: false });
  });

  it('marks a matching question right only when every prompt has its own match', () => {
    const quiz: ActivityDefinition = {
      ...base,
      steps: [{ id: 's', title: '', description: '', questions: [matching] }],
      assessment: { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true, revealAnswers: false },
    };
    expect(scoreAssessment(quiz, { pairs: ['m1', 'm2', 'm3', 'm4'] })).toMatchObject({ score: 100 });
    expect(scoreAssessment(quiz, { pairs: ['m2', 'm1', 'm3', 'm4'] })).toMatchObject({ score: 0 });
  });
});

describe('profile assessment', () => {
  const settings = (priorityQuestionIds: string[] = []) => ({
    mode: 'profile' as const,
    dimensions: [],
    profiles: [
      { id: 'lead', title: 'رهبر', description: 'd-lead' },
      { id: 'calm', title: 'آرام', description: 'd-calm' },
    ],
    tieBreak: { priorityQuestionIds, defaultProfileId: 'calm' },
    passingScore: null,
    showResult: true,
    revealAnswers: false,
  });
  const profile = (priorityQuestionIds?: string[]): ActivityDefinition => ({
    ...base,
    steps: [
      {
        id: 's',
        title: '',
        description: '',
        questions: [
          {
            id: 'q1',
            kind: 'single',
            title: 'q1',
            required: true,
            weight: 2,
            options: [
              { id: 'a', label: 'a', weights: { lead: 3, calm: -1 } },
              { id: 'b', label: 'b', weights: { calm: 2 } },
            ],
          },
          {
            id: 'q2',
            kind: 'multiple',
            title: 'q2',
            required: false,
            options: [
              { id: 'x', label: 'x', weights: { lead: 1 } },
              { id: 'y', label: 'y', weights: { calm: 1 } },
              { id: 'z', label: 'z' },
            ],
          },
        ],
      },
    ],
    assessment: settings(priorityQuestionIds),
  });

  it('adds every chosen option’s weight, times its question’s, and takes the highest', () => {
    // lead: 2×3 + 1 = 7; calm: 2×(−1) + 1 = −1.
    const result = scoreAssessment(profile(), { q1: 'a', q2: ['x', 'y'] })!;
    expect(result.profiles).toEqual([
      { id: 'lead', title: 'رهبر', score: 7 },
      { id: 'calm', title: 'آرام', score: -1 },
    ]);
    expect(result.outcome).toEqual({ title: 'رهبر', description: 'd-lead' });
    expect(result.tieBrokenBy).toBeNull();
  });

  it('breaks a tie by the priority questions, then by the default profile', () => {
    // Nothing answered: both 0, and the priority question splits nothing.
    expect(scoreAssessment(profile(['q2']), {})).toMatchObject({ outcome: { title: 'آرام' }, tieBrokenBy: 'default_profile' });

    // 1 – 1, and 1 – 1 on the priority question too: the default decides.
    expect(scoreAssessment(profile(['q2']), { q2: ['x', 'y'] })).toMatchObject({
      outcome: { title: 'آرام' },
      tieBrokenBy: 'default_profile',
    });

    // 6 – 6 in all, but 6 – (−2) on q1: the priority question decides.
    const split = profile(['q1']);
    split.steps[0].questions[1] = {
      id: 'q2',
      kind: 'multiple',
      title: 'q2',
      required: false,
      options: [
        { id: 'x', label: 'x', weights: { calm: 8 } },
        { id: 'y', label: 'y' },
      ],
    };
    expect(scoreAssessment(split, { q1: 'a', q2: ['x'] })).toMatchObject({
      outcome: { title: 'رهبر' },
      tieBrokenBy: 'priority_question',
    });
  });

  it('asks for two profiles, a default, and priority questions that are this activity’s choice questions', () => {
    const input = (assessment: object) => ({
      type: 'assessment',
      title: 'پروفایل',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: { ...profile(), assessment },
    });
    expect(activityInputSchema.safeParse(input(settings(['q1']))).success).toBe(true);
    expect(activityInputSchema.safeParse(input({ ...settings(), tieBreak: { priorityQuestionIds: [], defaultProfileId: null } })).success).toBe(false);
    expect(activityInputSchema.safeParse(input(settings(['nope']))).success).toBe(false);
    expect(activityInputSchema.safeParse(input({ ...settings(), profiles: settings().profiles.slice(0, 1) })).success).toBe(false);

    // Another mode keeps no weights.
    const knowledge = activityInputSchema.parse({
      ...input({ ...settings(), mode: 'personality', dimensions: [{ id: 'd', title: 'D', description: '' }] }),
      definition: {
        ...profile(),
        steps: [{ ...profile().steps[0], questions: profile().steps[0].questions.map((q) => ({ ...q, dimensionId: 'd' })) }],
        assessment: { ...settings(), mode: 'personality', dimensions: [{ id: 'd', title: 'D', description: '' }] },
      },
    });
    const first = knowledge.definition.steps[0].questions[0];
    expect(first.weight).toBeUndefined();
    expect('options' in first && first.options.every((option) => option.weights === undefined)).toBe(true);
    expect(knowledge.definition.assessment?.profiles).toBeUndefined();
  });
});

describe('earnsXp', () => {
  const passed = { mode: 'knowledge' as const, score: 80, passed: true, dimensions: [], outcome: null };
  const failed = { ...passed, score: 20, passed: false };

  it('ignores the result unless a pass is required', () => {
    expect(earnsXp(base, failed)).toBe(true);
    expect(earnsXp({ ...base, xp: { ...XP, requirePass: true } }, failed)).toBe(false);
    expect(earnsXp({ ...base, xp: { ...XP, requirePass: true } }, passed)).toBe(true);
  });

  it('pays nothing when XP is off or zero', () => {
    expect(earnsXp({ ...base, xp: { ...XP, enabled: false } }, null)).toBe(false);
    expect(earnsXp({ ...base, xp: { ...XP, amount: 0 } }, null)).toBe(false);
  });
});

describe('the shared rules', () => {
  const question = { id: 'q', kind: 'multiple' as const, title: 'q', required: true, maxSelections: 2, options: [{ id: 'a', label: 'a' }, { id: 'b', label: 'b' }, { id: 'c', label: 'c' }] };

  it('checks an answer against its question, and drops what is not a question', () => {
    expect(validateAnswers([question], { q: ['a', 'b', 'c'] })).toMatchObject({ ok: false });
    expect(validateAnswers([question], { q: [] })).toMatchObject({ ok: false });
    expect(validateAnswers([question], { q: ['a'], stray: 'x' })).toEqual({ ok: true, answers: { q: ['a'] } });
  });

  it('refuses a negative reward and clears what does not belong to the type', () => {
    const input = {
      type: 'survey',
      title: 'یك نظرسنجی',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: {
        ...base,
        review: 'manual',
        steps: [{ id: 's', title: '', description: '', questions: [question] }],
      },
    };
    expect(activityInputSchema.safeParse({ ...input, definition: { ...input.definition, xp: { ...XP, amount: -1 } } }).success).toBe(false);

    const parsed = activityInputSchema.parse(input);
    expect(parsed.title).toBe('یک نظرسنجی');
    expect(parsed.definition.review).toBe('auto');
  });

  it('takes a matching answer only when every prompt has a different match', () => {
    const player = {
      ...matching,
      pairs: undefined,
      prompts: matching.pairs.map((pair) => ({ id: pair.id, label: pair.prompt })),
      matches: matching.pairs.map((pair) => ({ id: pair.matchId, label: pair.match })),
    };
    expect(validateAnswers([player], { pairs: ['m4', 'm3', 'm2', 'm1'] })).toMatchObject({ ok: true });
    expect(validateAnswers([player], { pairs: ['m1', 'm2', 'm3'] })).toMatchObject({ ok: false });
    expect(validateAnswers([player], { pairs: ['m1', 'm1', 'm3', 'm4'] })).toMatchObject({ ok: false });
    expect(validateAnswers([player], { pairs: ['m1', 'm2', 'm3', 'x'] })).toMatchObject({ ok: false });
  });

  it('asks a matching question for at least four pairs', () => {
    const input = (pairs: typeof matching.pairs) => ({
      type: 'survey',
      title: 'تطبیق',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: { ...base, steps: [{ id: 's', title: '', description: '', questions: [{ ...matching, pairs }] }] },
    });
    expect(activityInputSchema.safeParse(input(matching.pairs)).success).toBe(true);
    expect(activityInputSchema.safeParse(input(matching.pairs.slice(0, 3))).success).toBe(false);
  });

  it('asks every image option for a picture, names an unnamed one, and keeps no picture on a text option', () => {
    const IMAGE = '00000000-0000-4000-8000-000000000001';
    const input = (q: object) => ({
      type: 'survey',
      title: 'تصویری',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: { ...base, steps: [{ id: 's', title: '', description: '', questions: [q] }] },
    });
    const options = [
      { id: 'a', label: 'برج', imageId: IMAGE },
      { id: 'b', label: '', imageId: IMAGE },
    ];

    const images = activityInputSchema.parse(input({ ...question, optionStyle: 'image', options }));
    const parsed = images.definition.steps[0].questions[0];
    expect('options' in parsed && parsed.options.map((option) => option.label)).toEqual(['برج', 'تصویر ۲']);

    const missing = activityInputSchema.safeParse(input({ ...question, optionStyle: 'image', options: [options[0], { id: 'b', label: 'b' }] }));
    expect(missing.error?.issues[0]?.path.join('.')).toBe('definition.steps.0.questions.0.options.1.imageId');

    expect(activityInputSchema.safeParse(input({ ...question, options })).success).toBe(false);
    const text = activityInputSchema.parse(input({ ...question, options: [options[0], { ...options[1], label: 'ب' }] }));
    const textQuestion = text.definition.steps[0].questions[0];
    expect('options' in textQuestion && textQuestion.options.every((option) => option.imageId === undefined)).toBe(true);
  });

  it('requires a key for every knowledge question', () => {
    const result = activityInputSchema.safeParse({
      type: 'assessment',
      title: 'آزمون',
      summary: '',
      instructions: '',
      audience: { kind: 'all' },
      startsAt: null,
      endsAt: null,
      definition: {
        ...base,
        steps: [{ id: 's', title: '', description: '', questions: [{ ...question, kind: 'single' }] }],
        assessment: { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true, revealAnswers: false },
      },
    });
    expect(result.success).toBe(false);
  });
});
