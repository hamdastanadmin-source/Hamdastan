import { describe, expect, it } from 'vitest';

import type { ActivityDefinition, JourneyResultSettings } from '@hamdastan/types';
import { activityInputSchema, journeyDayEndDefaults, journeyResultDefaults, motionOff, pickCharacter, traitScores } from '@hamdastan/validation';

/**
 * The final result's rule as plain functions, and what the builder may save:
 * each picked option adds its trait points; the top trait's character wins,
 * the first-listed trait on a tie; with no points, the default.
 */

const result = (overrides: Partial<JourneyResultSettings> = {}): JourneyResultSettings => ({
  ...journeyResultDefaults(),
  enabled: true,
  traits: [
    { id: 'brave', title: 'شجاعت' },
    { id: 'smart', title: 'هوش' },
  ],
  characters: [
    { id: 'lion', name: 'شیر', title: 'شجاع', description: '', imageId: null, traitId: 'brave' },
    { id: 'owl', name: 'جغد', title: 'دانا', description: '', imageId: null, traitId: 'smart' },
    { id: 'cat', name: 'گربه', title: 'کنجکاو', description: '', imageId: null, traitId: null },
  ],
  defaultCharacterId: 'cat',
  ...overrides,
});

const definition = (settings: JourneyResultSettings): ActivityDefinition => ({
  steps: [
    {
      id: 'd1',
      title: 'روز ۱',
      description: '',
      questions: [
        {
          id: 'q1',
          kind: 'single',
          title: 'چی کار می‌کنی؟',
          required: true,
          options: [
            { id: 'a', label: 'می‌پرم وسط', traits: { brave: 3 } },
            { id: 'b', label: 'فکر می‌کنم', traits: { smart: 2, brave: 1 } },
          ],
        },
        {
          id: 'q2',
          kind: 'multiple',
          title: 'کدوم‌ها؟',
          required: false,
          options: [
            { id: 'x', label: 'کتاب', traits: { smart: 2 } },
            { id: 'y', label: 'شمشیر', traits: { brave: 1 } },
            { id: 'z', label: 'هیچ' },
          ],
        },
      ],
    },
  ],
  estimatedMinutes: 3,
  maxSubmissions: 1,
  anonymous: false,
  review: 'auto',
  assessment: null,
  journey: {
    unlockMode: 'calendar_day',
    timezone: 'Asia/Tehran',
    missedDays: 'catch_up',
    requirePreviousDay: false,
    allowReview: true,
    questionsPerDay: 10,
    rewards: { perQuestion: 0, perDay: 0 },
    motions: { answer: motionOff(), dayComplete: motionOff(2500), journeyComplete: motionOff(3500) },
    dayEnd: journeyDayEndDefaults(),
    result: settings,
  },
  xp: { enabled: false, amount: 0, showBeforeStart: false, maxAwards: 1, requirePass: false },
});

describe('traitScores and pickCharacter', () => {
  const settings = result();
  const def = definition(settings);
  const pick = (answers: Record<string, string | string[] | null>) => pickCharacter(settings, traitScores(def, answers))?.id;

  it('adds every picked option’s points, including several of a multiple choice', () => {
    expect(Object.fromEntries(traitScores(def, { q1: 'b', q2: ['x', 'y'] }))).toEqual({ brave: 2, smart: 4 });
  });

  it('gives the top trait’s character', () => {
    expect(pick({ q1: 'a' })).toBe('lion');
    expect(pick({ q1: 'b', q2: ['x'] })).toBe('owl');
  });

  it('breaks a tie towards the trait listed first', () => {
    // brave 3 (a) vs smart 2 + 1 more from… none: make it even.
    expect(pick({ q1: 'b', q2: ['y'] })).toBe('lion'); // brave 2, smart 2
  });

  it('falls back to the default with no points, or no character for the top trait', () => {
    expect(pick({ q1: null, q2: ['z'] })).toBe('cat');
    const noOwl = result({ characters: result().characters.filter((c) => c.id !== 'owl') });
    expect(pickCharacter(noOwl, traitScores(definition(noOwl), { q1: 'b', q2: ['x'] }))?.id).toBe('cat');
  });

  it('gives nothing when results are off', () => {
    expect(pickCharacter(result({ enabled: false }), new Map())).toBeNull();
  });
});

describe('what the builder may save', () => {
  const input = (settings: JourneyResultSettings) => ({
    type: 'journey' as const,
    title: 'نتیجه',
    summary: '',
    instructions: '',
    audience: { kind: 'all' as const },
    startsAt: new Date().toISOString(),
    endsAt: null,
    definition: definition(settings),
  });
  const paths = (settings: JourneyResultSettings) => {
    const parsed = activityInputSchema.safeParse(input(settings));
    return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'));
  };

  it('takes a complete set of results', () => {
    expect(paths(result())).toEqual([]);
  });

  it('needs a character and a default', () => {
    expect(paths(result({ characters: [], defaultCharacterId: null }))).toEqual(
      expect.arrayContaining(['definition.journey.result.characters', 'definition.journey.result.defaultCharacterId'])
    );
  });

  it('gives a trait to one character only, and points only to traits that exist', () => {
    const twice = result({ characters: [...result().characters, { id: 'bear', name: 'خرس', title: '', description: '', imageId: null, traitId: 'brave' }] });
    expect(paths(twice)).toContain('definition.journey.result.characters.3.traitId');
    const def = definition(result());
    const q = def.steps[0].questions[0];
    if (q.kind === 'single') q.options[0].traits = { ghost: 1 };
    const parsed = activityInputSchema.safeParse({ ...input(result()), definition: def });
    expect(parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.'))).toContain('definition.steps.0.questions.0.options.0.traits');
  });

  it('drops trait points from any other type', () => {
    const parsed = activityInputSchema.parse({ ...input(result()), type: 'survey', startsAt: null });
    const q = parsed.definition.steps[0].questions[0];
    expect('options' in q && q.options[0].traits).toBeUndefined();
  });
});
