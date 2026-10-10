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
  xp: XP,
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
      assessment: { mode: 'knowledge', dimensions: [], passingScore: 50, showResult: true },
    };
    expect(scoreAssessment(quiz, { m: ['1', '2'] })).toMatchObject({ score: 100, passed: true });
    expect(scoreAssessment(quiz, { m: ['1'] })).toMatchObject({ score: 0, passed: false });
    expect(scoreAssessment(quiz, { m: ['1', '2', '3'] })).toMatchObject({ score: 0, passed: false });
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
        assessment: { mode: 'knowledge', dimensions: [], passingScore: null, showResult: true },
      },
    });
    expect(result.success).toBe(false);
  });
});
