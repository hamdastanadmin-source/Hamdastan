import { describe, expect, it } from 'vitest';

import type { QuestionnaireState } from '@hamdastan/types';

import {
  buildSteps,
  initialStep,
  mergeRanking,
  moveItem,
  progressOf,
  stepAfter,
  stepBefore,
} from './questionnaire-flow';

const state = (patch: Partial<QuestionnaireState>): QuestionnaireState => ({
  answers: {},
  resumeQuestionId: 'Q2',
  progress: 0,
  completed: false,
  result: null,
  ...patch,
});

describe('the step sequence', () => {
  it('is four chapters with a reward after the first three', () => {
    const kinds = buildSteps({}).map((step) =>
      step.kind === 'question' ? step.questionId : step.kind === 'reward' ? `R${step.section}` : step.kind
    );
    expect(kinds).toEqual([
      'intro',
      'Q2', 'Q4', 'Q5', 'Q19', 'Q3', 'R1',
      'Q6', 'Q7', 'Q18', 'Q20', 'Q1', 'R2',
      'Q8', 'Q9', 'Q11', 'Q12', 'Q13', 'R3',
      'Q10', 'Q14', 'Q15', 'Q16', 'Q17',
    ]);
  });

  it('ranks Q1 only when more than one motivation is picked', () => {
    const one = { Q1: { ranked: ['FUN'] } };
    const two = { Q1: { ranked: ['FUN', 'SOCIAL'] } };
    expect(stepAfter({ kind: 'question', questionId: 'Q1' }, one)).toEqual({ kind: 'reward', section: 2 });
    expect(stepAfter({ kind: 'question', questionId: 'Q1' }, two)).toEqual({ kind: 'rank' });
    expect(stepAfter({ kind: 'rank' }, two)).toEqual({ kind: 'reward', section: 2 });
  });

  it('goes to processing after the last question', () => {
    expect(stepAfter({ kind: 'question', questionId: 'Q17' }, {})).toEqual({ kind: 'processing' });
  });

  it('goes back through rewards and to the intro', () => {
    expect(stepBefore({ kind: 'question', questionId: 'Q6' }, {})).toEqual({ kind: 'reward', section: 1 });
    expect(stepBefore({ kind: 'question', questionId: 'Q2' }, {})).toEqual({ kind: 'intro' });
    expect(stepBefore({ kind: 'intro' }, {})).toBeNull();
  });
});

describe('where someone lands', () => {
  it('shows the intro to a first visit', () => {
    expect(initialStep(state({}))).toEqual({ kind: 'intro' });
  });

  it('resumes at the first unanswered question', () => {
    expect(
      initialStep(state({ answers: { Q2: { option: 'INITIATES' } }, resumeQuestionId: 'Q4' }))
    ).toEqual({ kind: 'question', questionId: 'Q4' });
  });

  it('returns to the last question when everything is answered but not finished', () => {
    expect(
      initialStep(state({ answers: { Q2: { option: 'INITIATES' } }, resumeQuestionId: null }))
    ).toEqual({ kind: 'question', questionId: 'Q17' });
  });

  it('shows the result once finished', () => {
    expect(initialStep(state({ completed: true }))).toEqual({ kind: 'result' });
  });
});

describe('progress', () => {
  it('lands on 25 / 50 / 75 at the rewards and never counts questions', () => {
    expect(progressOf({ kind: 'question', questionId: 'Q2' })).toBe(0);
    expect(progressOf({ kind: 'reward', section: 1 })).toBe(25);
    expect(progressOf({ kind: 'question', questionId: 'Q6' })).toBe(25);
    expect(progressOf({ kind: 'reward', section: 2 })).toBe(50);
    expect(progressOf({ kind: 'reward', section: 3 })).toBe(75);
    expect(progressOf({ kind: 'processing' })).toBe(100);
  });
});

describe('ranking', () => {
  it('keeps the existing order, appends new picks, drops removed ones', () => {
    expect(mergeRanking(['FUN', 'SOCIAL'], ['SOCIAL', 'FUN', 'ESCAPE'])).toEqual(['FUN', 'SOCIAL', 'ESCAPE']);
    expect(mergeRanking(['FUN', 'SOCIAL'], ['SOCIAL'])).toEqual(['SOCIAL']);
    expect(mergeRanking([], ['ESCAPE', 'FUN'])).toEqual(['ESCAPE', 'FUN']);
  });

  it('moves an item one place and stops at the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
