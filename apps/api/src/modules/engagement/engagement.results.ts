import { ENGAGEMENT_TEXT_SAMPLE_SIZE } from '@hamdastan/config';
import type {
  ActivityAnswerValue,
  ActivityDefinition,
  ActivityQuestion,
  AssessmentStats,
  QuestionStat,
} from '@hamdastan/types';

import type { ResponseRow } from './engagement.types';

/**
 * The results dashboard's figures and the CSV export, as pure functions of
 * the responses. Nothing here sees who answered: the service hands over
 * identities only for an activity that is not anonymous, and only the
 * export prints them.
 *
 * Per-question figures are drawn against the current version's questions;
 * an answer to a question a later version removed is not counted.
 */

const round1 = (value: number) => Math.round(value * 10) / 10;

export function questionStats(definition: ActivityDefinition, responses: ResponseRow[]): QuestionStat[] {
  return definition.steps.flatMap((step) =>
    step.questions.map((question) => {
      const values = responses
        .map((response) => response.answers[question.id])
        .filter((value) => value !== undefined);
      const base = {
        questionId: question.id,
        stepTitle: step.title,
        title: question.title,
        kind: question.kind,
        answered: values.length,
      };

      switch (question.kind) {
        case 'single':
        case 'multiple': {
          const picks = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
          return {
            ...base,
            options: question.options.map((option) => ({
              id: option.id,
              label: option.label,
              count: picks.filter((pick) => pick === option.id).length,
            })),
          };
        }
        case 'rating':
        case 'scale': {
          const numbers = values.filter((value): value is number => typeof value === 'number');
          const [min, max] = question.kind === 'rating' ? [1, question.max] : [question.min, question.max];
          return {
            ...base,
            average: numbers.length ? round1(numbers.reduce((sum, n) => sum + n, 0) / numbers.length) : null,
            distribution: Array.from({ length: max - min + 1 }, (_, i) => ({
              value: min + i,
              count: numbers.filter((n) => n === min + i).length,
            })),
          };
        }
        case 'text':
          // Newest first; the responses arrive in that order.
          return {
            ...base,
            texts: values
              .filter((value): value is string => typeof value === 'string')
              .slice(0, ENGAGEMENT_TEXT_SAMPLE_SIZE),
          };
      }
    })
  );
}

export function assessmentStats(definition: ActivityDefinition, responses: ResponseRow[]): AssessmentStats | null {
  const settings = definition.assessment;
  if (!settings) return null;

  const scores = responses.map((r) => r.score).filter((score): score is number => score !== null);
  const verdicts = responses.map((r) => r.passed).filter((passed): passed is boolean => passed !== null);

  return {
    mode: settings.mode,
    averageScore: scores.length ? round1(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null,
    passRate: verdicts.length ? verdicts.filter(Boolean).length / verdicts.length : null,
    outcomes: settings.dimensions.map((dimension) => ({
      dimensionId: dimension.id,
      title: dimension.title,
      count: responses.filter((r) => r.result?.outcome?.title === dimension.title).length,
    })),
  };
}

/** An answer as a person reads it: option labels, not ids. */
export function describeAnswer(question: ActivityQuestion, value: ActivityAnswerValue | undefined): string {
  if (value === undefined) return '';
  if (question.kind === 'single' || question.kind === 'multiple') {
    const ids = Array.isArray(value) ? value : [String(value)];
    return ids.map((id) => question.options.find((option) => option.id === id)?.label ?? id).join('، ');
  }
  return String(value);
}

/** RFC 4180: quote every field, double any quote inside it. */
function csvField(value: string | number | null): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * The export, one row per response. Identity columns exist only when
 * `withIdentity` is true, which the service sets for an activity that is not
 * anonymous — so an anonymous survey's export has nothing that names anyone,
 * and its rows arrive in no particular order. A leading BOM makes Excel read
 * the Persian as UTF-8.
 */
export function toCsv(definition: ActivityDefinition, responses: ResponseRow[], withIdentity: boolean): string {
  const questions = definition.steps.flatMap((step) => step.questions);
  const assessed = definition.assessment !== null;

  const header = [
    ...(withIdentity ? ['نام', 'شماره موبایل', 'زمان ثبت'] : ['تاریخ ثبت']),
    ...questions.map((question) => question.title),
    ...(assessed ? ['نمره', 'قبولی', 'نتیجه'] : []),
  ];

  const rows = responses.map((response) => [
    ...(withIdentity
      ? [response.user?.name ?? '', response.user?.phone ?? '', response.submittedAt.toISOString()]
      : [response.submittedAt.toISOString().slice(0, 10)]),
    ...questions.map((question) => describeAnswer(question, response.answers[question.id])),
    ...(assessed
      ? [
          response.score,
          response.passed === null ? '' : response.passed ? 'بله' : 'خیر',
          response.result?.outcome?.title ?? '',
        ]
      : []),
  ]);

  return `﻿${[header, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n')}\r\n`;
}
