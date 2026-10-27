/**
 * Questions from a spreadsheet — the rows of the Excel template, turned into
 * activity questions and checked with the same `activityQuestionSchema` the
 * builder and the API use.
 *
 * Pure: it takes rows of cells (however they were read) and answers with one
 * entry per non-empty row — the question, or why that row will not do — so
 * the admin sees every problem at once, by row number, before anything is
 * added. Ids come from the caller, so the result is deterministic in tests.
 */

import {
  ENGAGEMENT_LIMITS as L,
  QUESTION_KIND_LABELS,
  QUESTION_KINDS,
  type QuestionKindId,
  UNDIMENSIONED_KINDS,
} from '@hamdastan/config';
import { toLatinDigits, toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, ActivityType, AssessmentMode } from '@hamdastan/types';

import { activityQuestionSchema } from './engagement';

const fa = (n: number) => toPersianDigits(n);
import {
  sheetInteger as integer,
  sheetKey as headerKey,
  sheetList as list,
  sheetRecords,
  sheetText as text,
  type SheetCell as Cell,
  type SheetColumn,
} from './sheet';

const OPTION_NUMBERS = Array.from({ length: L.OPTIONS_MAX }, (_, i) => i + 1);

type ColumnKey =
  | 'type'
  | 'title'
  | 'description'
  | 'required'
  | `option${number}`
  | 'maxSelections'
  | 'correct'
  | 'explanation'
  | `score${number}`
  | 'range'
  | 'minLabel'
  | 'maxLabel'
  | 'dimension'
  | 'reverse'
  | 'step';

/**
 * One column per option, then one per option's score. Only the first of each
 * carries a hint, so the dialog explains the run once.
 */
const numbered = (key: 'option' | 'score', title: string, hint: string): SheetColumn<ColumnKey>[] =>
  OPTION_NUMBERS.map((n) => ({ key: `${key}${n}`, title: `${title} ${fa(n)}`, hint: n === 1 ? hint : '' }));

/** The template's columns, in order. A header is recognised by its title; order and extra columns do not matter. */
export const QUESTION_IMPORT_COLUMNS: readonly SheetColumn<ColumnKey>[] = [
  { key: 'type', title: 'نوع', hint: 'تک‌گزینه‌ای، چندگزینه‌ای، متنی، امتیازی، طیفی یا تطبیقی' },
  { key: 'title', title: 'متن سؤال', hint: 'الزامی' },
  { key: 'description', title: 'توضیح', hint: 'اختیاری' },
  { key: 'required', title: 'الزامی', hint: 'بله / خیر — پیش‌فرض بله' },
  ...numbered('option', 'گزینه', `تا گزینه ${fa(L.OPTIONS_MAX)}، هر گزینه در ستون خودش — تطبیقی: سیب = قرمز`),
  { key: 'maxSelections', title: 'حداکثر انتخاب', hint: 'فقط چندگزینه‌ای' },
  { key: 'correct', title: 'پاسخ درست', hint: 'آزمون دانشی و مسابقه: متن یا شماره‌ی گزینه' },
  { key: 'explanation', title: 'توضیح پاسخ', hint: 'آزمون دانشی و مسابقه: چرا پاسخ درست، درست است' },
  ...numbered(
    'score',
    'امتیاز گزینه',
    `آزمون شخصیت‌شناسی، امتیاز همان گزینه: یک عدد برای بُعد سطر، یا چند بُعد: برونگرایی = 3 | نظم = -2`
  ),
  { key: 'range', title: 'بازه', hint: 'امتیازی: 5 یا 10 — طیفی: 1-5' },
  { key: 'minLabel', title: 'برچسب ابتدا', hint: 'فقط طیفی' },
  { key: 'maxLabel', title: 'برچسب انتها', hint: 'فقط طیفی' },
  { key: 'dimension', title: 'بُعد', hint: 'آزمون شخصیت‌شناسی: عنوان بُعد — برای امتیازی و طیفی الزامی' },
  { key: 'reverse', title: 'معکوس', hint: 'آزمون شخصیت‌شناسی، امتیازی و طیفی: بله / خیر' },
  { key: 'step', title: 'مرحله', hint: 'مأموریت: عنوان مرحله' },
];

export type ImportedQuestionRow = {
  /** 1-based, as the spreadsheet numbers it (the header is row 1). */
  row: number;
  /** The question text as written, shown even when the row is refused. */
  title: string;
  /** Mission only: the step it belongs to; empty for the first/only step. */
  stepTitle: string;
  /**
   * Personality only: the dimensions the question's `dimensionId` and options'
   * `dimensionScores` point to, under ids minted for this row. The caller
   * matches each by title, or creates it.
   */
  dimensions: { id: string; title: string }[];
  question: ActivityQuestion | null;
  errors: string[];
};

export type QuestionImportContext = {
  type: ActivityType;
  /** For an assessment. */
  mode?: AssessmentMode;
  /** Mints ids for questions and options. */
  newId: () => string;
};

export type QuestionImportResult =
  | { ok: true; rows: ImportedQuestionRow[] }
  | { ok: false; error: string };


const KIND_BY_NAME = new Map<string, QuestionKindId>([
  ...QUESTION_KINDS.map((kind) => [headerKey(QUESTION_KIND_LABELS[kind]), kind] as const),
  ...QUESTION_KINDS.map((kind) => [kind, kind] as const),
  ['تکگزینه', 'single'],
  ['چندگزینه', 'multiple'],
  ['تشریحی', 'text'],
  ['ستاره', 'rating'],
  ['لیکرت', 'scale'],
  ['جفتکردنی', 'matching'],
]);

const YES = new Set(['بله', 'آره', 'yes', 'y', 'true', '1', '✓']);
const NO = new Set(['خیر', 'نه', 'no', 'n', 'false', '0']);

function flag(cell: Cell, fallback: boolean): boolean | null {
  if (typeof cell === 'boolean') return cell;
  const value = text(cell).toLowerCase();
  if (!value) return fallback;
  if (YES.has(value)) return true;
  if (NO.has(value)) return false;
  return null;
}

/**
 * An option's score cell → points by dimension title: a bare number goes to
 * the row's «بُعد», `عنوان = عدد` to that dimension; parts are `|`-separated.
 */
function dimensionPoints(cell: Cell, rowDimension: string, n: number, errors: string[]): Map<string, number> {
  const points = new Map<string, number>();
  for (const part of list(cell)) {
    const [title, value] = part.includes('=') ? part.split('=').map((side) => side.trim()) : [rowDimension, part];
    const score = Number(toLatinDigits(value));
    if (!title) errors.push(`امتیاز گزینه ${fa(n)}: ستون «بُعد» را پر کنید یا بنویسید «بُعد = امتیاز»`);
    else if (!Number.isInteger(score) || Math.abs(score) > L.DIMENSION_SCORE_MAX) {
      errors.push(`امتیاز گزینه ${fa(n)} باید عددی صحیح بین ${fa(-L.DIMENSION_SCORE_MAX)} و ${fa(L.DIMENSION_SCORE_MAX)} باشد`);
    } else if (score !== 0) points.set(title, (points.get(title) ?? 0) + score);
  }
  return points;
}

function rowToQuestion(
  cells: Record<ColumnKey, Cell>,
  context: QuestionImportContext
): { question: unknown; errors: string[]; dimensions: { id: string; title: string }[] } {
  const errors: string[] = [];
  // Each option with the number of its column, so its score column is found even past a skipped one.
  const options = OPTION_NUMBERS.map((n) => ({ n, label: text(cells[`option${n}`]) })).filter((option) => option.label);
  for (const n of OPTION_NUMBERS) {
    if (!text(cells[`option${n}`]) && text(cells[`score${n}`])) errors.push(`«امتیاز گزینه ${fa(n)}» گزینه‌ای ندارد`);
  }
  const typeText = headerKey(cells.type);
  const kind: QuestionKindId | undefined = typeText
    ? KIND_BY_NAME.get(typeText)
    : options.length > 0
      ? 'single'
      : 'text';
  if (!kind) {
    errors.push(`نوع «${text(cells.type)}» شناخته نشد؛ نوع‌های مجاز: ${QUESTION_KINDS.map((k) => QUESTION_KIND_LABELS[k]).join('، ')}`);
    return { question: null, errors, dimensions: [] };
  }

  const required = flag(cells.required, true);
  if (required === null) errors.push('ستون «الزامی» باید «بله» یا «خیر» باشد');
  const reverse = flag(cells.reverse, false);
  if (reverse === null) errors.push('ستون «معکوس» باید «بله» یا «خیر» باشد');

  // A competition is always a knowledge quiz.
  const personality = context.type === 'assessment' && context.mode === 'personality';
  const knowledge = context.type === 'competition' || (context.type === 'assessment' && context.mode === 'knowledge');
  const ranged = kind === 'rating' || kind === 'scale';
  const rowDimension = personality && !UNDIMENSIONED_KINDS.includes(kind) ? text(cells.dimension) : '';
  if (personality && ranged && !rowDimension) errors.push('آزمون شخصیت‌شناسی: ستون «بُعد» را پر کنید');

  // Personality: one id per dimension title this row names, for the caller to match.
  const dimensions: { id: string; title: string }[] = [];
  const dimensionId = (title: string) => {
    let dimension = dimensions.find((d) => d.title === title);
    if (!dimension) dimensions.push((dimension = { id: context.newId(), title }));
    return dimension.id;
  };

  const base = {
    id: context.newId(),
    title: text(cells.title),
    ...(text(cells.description) ? { description: text(cells.description) } : {}),
    required: required ?? true,
    ...(rowDimension && ranged ? { dimensionId: dimensionId(rowDimension), ...(reverse ? { reverse: true } : {}) } : {}),
  };

  switch (kind) {
    case 'single':
    case 'multiple': {
      const labels = options.map((option) => option.label);
      const scores = personality
        ? options.map(({ n }) => {
            const points = dimensionPoints(cells[`score${n}`], rowDimension, n, errors);
            return Object.fromEntries([...points].map(([title, value]) => [dimensionId(title), value]));
          })
        : [];
      if (personality && scores.every((points) => Object.keys(points).length === 0)) {
        errors.push('امتیاز گزینه‌ها را دست‌کم برای یک بُعد وارد کنید');
      }

      const correct = new Set<number>();
      if (knowledge) {
        for (const answer of list(cells.correct)) {
          const asNumber = Number(toLatinDigits(answer));
          const index = Number.isInteger(asNumber) && asNumber >= 1 ? asNumber - 1 : labels.indexOf(answer);
          if (index < 0 || index >= labels.length) errors.push(`پاسخ درست «${answer}» بین گزینه‌ها نیست`);
          else correct.add(index);
        }
      }

      const maxSelections = integer(cells.maxSelections);
      if (Number.isNaN(maxSelections)) errors.push('«حداکثر انتخاب» باید عدد باشد');

      return {
        dimensions,
        errors,
        question: {
          ...base,
          kind,
          options: labels.map((label, i) => ({
            id: context.newId(),
            label,
            ...(correct.has(i) ? { correct: true } : {}),
            ...(scores[i] && Object.keys(scores[i]).length ? { dimensionScores: scores[i] } : {}),
          })),
          ...(kind === 'multiple' && maxSelections && !Number.isNaN(maxSelections) ? { maxSelections } : {}),
          ...(knowledge && text(cells.explanation) ? { explanation: text(cells.explanation) } : {}),
        },
      };
    }
    case 'text':
      return { dimensions, errors, question: { ...base, kind, multiline: true } };
    case 'matching': {
      const pairs = options.map((option) => option.label.split('=').map((side) => side.trim()));
      if (pairs.some((sides) => sides.length !== 2 || !sides[0] || !sides[1])) {
        errors.push('هر جفت را در ستون گزینه‌ی خودش به شکل «مورد = جفت» بنویسید');
      }
      return {
        dimensions,
        errors,
        question: {
          ...base,
          kind,
          pairs: pairs.map(([prompt = '', match = '']) => ({ id: context.newId(), prompt, matchId: context.newId(), match })),
          ...(knowledge && text(cells.explanation) ? { explanation: text(cells.explanation) } : {}),
        },
      };
    }
    case 'rating': {
      const range = toLatinDigits(text(cells.range));
      const max = Number(range.split('-').pop() || 5);
      if (max !== 5 && max !== 10) errors.push('بازه‌ی سؤال امتیازی باید ۵ یا ۱۰ باشد');
      return { dimensions, errors, question: { ...base, kind, max } };
    }
    case 'scale': {
      const range = toLatinDigits(text(cells.range)) || '1-5';
      const [min, max] = range.split('-').map((part) => Number(part.trim()));
      if (!Number.isInteger(min) || !Number.isInteger(max)) errors.push('بازه‌ی طیف را به شکل 1-5 بنویسید');
      return {
        dimensions,
        errors,
        question: {
          ...base,
          kind,
          min,
          max,
          minLabel: text(cells.minLabel),
          maxLabel: text(cells.maxLabel),
        },
      };
    }
  }
}

/**
 * Rows of cells → questions. The first non-empty row is the header; it must
 * have «متن سؤال». Empty rows are skipped. Every other row answers with its
 * question or its errors — nothing is dropped silently.
 */
export function parseQuestionRows(rows: Cell[][], context: QuestionImportContext): QuestionImportResult {
  const sheet = sheetRecords(rows, QUESTION_IMPORT_COLUMNS, 'title');
  if (!sheet.ok) return sheet;

  const parsed: ImportedQuestionRow[] = sheet.records.map(({ row, cells }) => {
    const { question, errors, dimensions } = rowToQuestion(cells, context);
    let checked: ActivityQuestion | null = null;
    if (question && errors.length === 0) {
      const result = activityQuestionSchema.safeParse(question);
      if (result.success) checked = result.data as ActivityQuestion;
      else errors.push(...new Set(result.error.issues.map((issue) => issue.message)));
    }
    return {
      row,
      title: text(cells.title),
      stepTitle: context.type === 'mission' ? text(cells.step) : '',
      dimensions,
      question: checked,
      errors,
    };
  });

  if (parsed.length > L.QUESTIONS_MAX) {
    return { ok: false, error: `حداکثر ${fa(L.QUESTIONS_MAX)} سؤال در هر فعالیت` };
  }
  return { ok: true, rows: parsed };
}

/** The template's example rows, one per kind, for the downloadable file. */
export const QUESTION_IMPORT_EXAMPLES: Partial<Record<ColumnKey, string>>[] = [
  { type: 'تک‌گزینه‌ای', title: 'بیشتر کتاب می‌خونی یا فیلم می‌بینی؟', required: 'بله', option1: 'کتاب', option2: 'فیلم', option3: 'هر دو' },
  { type: 'چندگزینه‌ای', title: 'کدوم ژانرها رو دوست داری؟', option1: 'فانتزی', option2: 'تاریخی', option3: 'جنایی', maxSelections: '2' },
  { type: 'امتیازی', title: 'چقدر از خوندن لذت می‌بری؟', range: '5' },
  { type: 'طیفی', title: 'از جمع انرژی می‌گیرم', range: '1-5', minLabel: 'اصلاً', maxLabel: 'کاملاً' },
  { type: 'متنی', title: 'آخرین کتابی که خوندی چی بود؟', required: 'خیر' },
  {
    type: 'تطبیقی',
    title: 'هر کتاب رو به نویسنده‌اش وصل کن',
    option1: 'بوف کور = صادق هدایت',
    option2: 'سووشون = سیمین دانشور',
    option3: 'کلیدر = محمود دولت‌آبادی',
    option4: 'شازده احتجاب = هوشنگ گلشیری',
  },
];
