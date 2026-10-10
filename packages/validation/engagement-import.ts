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

import { ENGAGEMENT_LIMITS as L, QUESTION_KIND_LABELS, QUESTION_KINDS, type QuestionKindId } from '@hamdastan/config';
import { normalizePersianText, toLatinDigits, toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityQuestion, ActivityType, AssessmentMode } from '@hamdastan/types';

import { activityQuestionSchema } from './engagement';

/** The template's columns, in order. A header is recognised by its title; order and extra columns do not matter. */
export const QUESTION_IMPORT_COLUMNS = [
  { key: 'type', title: 'نوع', hint: 'تک‌گزینه‌ای، چندگزینه‌ای، متنی، امتیازی یا طیفی' },
  { key: 'title', title: 'متن سؤال', hint: 'الزامی' },
  { key: 'description', title: 'توضیح', hint: 'اختیاری' },
  { key: 'required', title: 'الزامی', hint: 'بله / خیر — پیش‌فرض بله' },
  { key: 'options', title: 'گزینه‌ها', hint: 'با | جدا کن: کتاب | فیلم | هر دو' },
  { key: 'maxSelections', title: 'حداکثر انتخاب', hint: 'فقط چندگزینه‌ای' },
  { key: 'correct', title: 'پاسخ درست', hint: 'آزمون دانشی: متن یا شماره‌ی گزینه' },
  { key: 'scores', title: 'امتیاز گزینه‌ها', hint: 'آزمون شخصیت‌شناسی: 0 | 2 | 4' },
  { key: 'range', title: 'بازه', hint: 'امتیازی: 5 یا 10 — طیفی: 1-5' },
  { key: 'minLabel', title: 'برچسب ابتدا', hint: 'فقط طیفی' },
  { key: 'maxLabel', title: 'برچسب انتها', hint: 'فقط طیفی' },
  { key: 'dimension', title: 'بُعد', hint: 'آزمون شخصیت‌شناسی: عنوان بُعد' },
  { key: 'reverse', title: 'معکوس', hint: 'آزمون شخصیت‌شناسی: بله / خیر' },
  { key: 'step', title: 'مرحله', hint: 'مأموریت: عنوان مرحله' },
] as const;

type ColumnKey = (typeof QUESTION_IMPORT_COLUMNS)[number]['key'];

export type ImportedQuestionRow = {
  /** 1-based, as the spreadsheet numbers it (the header is row 1). */
  row: number;
  /** The question text as written, shown even when the row is refused. */
  title: string;
  /** Mission only: the step it belongs to; empty for the first/only step. */
  stepTitle: string;
  /** Personality only: the dimension's title, matched or created by the caller. */
  dimensionTitle: string | null;
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

type Cell = string | number | boolean | Date | null | undefined;

const fa = (n: number) => toPersianDigits(n);

/** A cell as trimmed text, with Persian letters and Latin digits. */
const text = (cell: Cell) =>
  cell === null || cell === undefined ? '' : normalizePersianText(cell instanceof Date ? cell.toISOString() : String(cell));

/** A header as compared: no spaces or ZWNJ, so «متن سوال» and «متن‌ سؤال» match. */
const headerKey = (cell: Cell) => text(cell).replace(/[\s‌]/g, '').replace(/ؤ/g, 'و').toLowerCase();

const KIND_BY_NAME = new Map<string, QuestionKindId>([
  ...QUESTION_KINDS.map((kind) => [headerKey(QUESTION_KIND_LABELS[kind]), kind] as const),
  ...QUESTION_KINDS.map((kind) => [kind, kind] as const),
  ['تکگزینه', 'single'],
  ['چندگزینه', 'multiple'],
  ['تشریحی', 'text'],
  ['ستاره', 'rating'],
  ['لیکرت', 'scale'],
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

/** «a | b | c», or one per line in the cell. */
const list = (cell: Cell) =>
  text(cell) === ''
    ? []
    : String(cell)
        .split(/[|\n]/)
        .map((part) => normalizePersianText(part))
        .filter(Boolean);

function integer(cell: Cell): number | null {
  const value = text(cell);
  if (!value) return null;
  const n = Number(toLatinDigits(value));
  return Number.isInteger(n) ? n : NaN;
}

function rowToQuestion(
  cells: Record<ColumnKey, Cell>,
  context: QuestionImportContext
): { question: unknown; errors: string[]; dimensionTitle: string | null } {
  const errors: string[] = [];
  const options = list(cells.options);
  const typeText = headerKey(cells.type);
  const kind: QuestionKindId | undefined = typeText
    ? KIND_BY_NAME.get(typeText)
    : options.length > 0
      ? 'single'
      : 'text';
  if (!kind) {
    errors.push(`نوع «${text(cells.type)}» شناخته نشد؛ یکی از: ${QUESTION_KINDS.map((k) => QUESTION_KIND_LABELS[k]).join('، ')}`);
    return { question: null, errors, dimensionTitle: null };
  }

  const required = flag(cells.required, true);
  if (required === null) errors.push('ستون «الزامی» باید بله یا خیر باشه');
  const reverse = flag(cells.reverse, false);
  if (reverse === null) errors.push('ستون «معکوس» باید بله یا خیر باشه');

  const personality = context.type === 'assessment' && context.mode === 'personality';
  const knowledge = context.type === 'assessment' && context.mode === 'knowledge';
  const dimensionTitle = personality && kind !== 'text' ? text(cells.dimension) || null : null;
  if (personality && kind !== 'text' && !dimensionTitle) errors.push('آزمون شخصیت‌شناسی: ستون «بُعد» رو پر کن');

  const base = {
    id: context.newId(),
    title: text(cells.title),
    ...(text(cells.description) ? { description: text(cells.description) } : {}),
    required: required ?? true,
    ...(personality && reverse ? { reverse: true } : {}),
  };

  switch (kind) {
    case 'single':
    case 'multiple': {
      const scores = list(cells.scores).map((s) => Number(toLatinDigits(s)));
      if (personality && scores.length > 0 && scores.length !== options.length) {
        errors.push(`تعداد امتیازها (${fa(scores.length)}) با تعداد گزینه‌ها (${fa(options.length)}) برابر نیست`);
      }
      if (scores.some((s) => !Number.isInteger(s) || s < -10 || s > 10)) errors.push('امتیاز هر گزینه عدد صحیح بین ۱۰- و ۱۰ باشه');

      const correct = new Set<number>();
      if (knowledge) {
        for (const answer of list(cells.correct)) {
          const asNumber = Number(toLatinDigits(answer));
          const index = Number.isInteger(asNumber) && asNumber >= 1 ? asNumber - 1 : options.indexOf(answer);
          if (index < 0 || index >= options.length) errors.push(`پاسخ درست «${answer}» بین گزینه‌ها نیست`);
          else correct.add(index);
        }
      }

      const maxSelections = integer(cells.maxSelections);
      if (Number.isNaN(maxSelections)) errors.push('«حداکثر انتخاب» باید عدد باشه');

      return {
        dimensionTitle,
        errors,
        question: {
          ...base,
          kind,
          options: options.map((label, i) => ({
            id: context.newId(),
            label,
            ...(correct.has(i) ? { correct: true } : {}),
            ...(personality ? { score: scores[i] ?? 0 } : {}),
          })),
          ...(kind === 'multiple' && maxSelections && !Number.isNaN(maxSelections) ? { maxSelections } : {}),
        },
      };
    }
    case 'text':
      return { dimensionTitle, errors, question: { ...base, kind, multiline: true } };
    case 'rating': {
      const range = toLatinDigits(text(cells.range));
      const max = Number(range.split('-').pop() || 5);
      if (max !== 5 && max !== 10) errors.push('بازه‌ی سؤال امتیازی ۵ یا ۱۰ هست');
      return { dimensionTitle, errors, question: { ...base, kind, max } };
    }
    case 'scale': {
      const range = toLatinDigits(text(cells.range)) || '1-5';
      const [min, max] = range.split('-').map((part) => Number(part.trim()));
      if (!Number.isInteger(min) || !Number.isInteger(max)) errors.push('بازه‌ی طیف رو به شکل 1-5 بنویس');
      return {
        dimensionTitle,
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
  const headerIndex = rows.findIndex((row) => row.some((cell) => text(cell) !== ''));
  if (headerIndex === -1) return { ok: false, error: 'فایل خالیه' };

  const columnByHeader = new Map(QUESTION_IMPORT_COLUMNS.map((column) => [headerKey(column.title), column.key]));
  const columns = rows[headerIndex].map((cell) => columnByHeader.get(headerKey(cell)));
  if (!columns.includes('title')) {
    return { ok: false, error: 'ستون «متن سؤال» پیدا نشد. از فایل نمونه استفاده کن.' };
  }

  const parsed: ImportedQuestionRow[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((cell) => text(cell) !== '')) return;
    const cells = Object.fromEntries(
      QUESTION_IMPORT_COLUMNS.map(({ key }) => [key, row[columns.indexOf(key)]])
    ) as Record<ColumnKey, Cell>;

    const { question, errors, dimensionTitle } = rowToQuestion(cells, context);
    let checked: ActivityQuestion | null = null;
    if (question && errors.length === 0) {
      const result = activityQuestionSchema.safeParse(question);
      if (result.success) checked = result.data as ActivityQuestion;
      else errors.push(...new Set(result.error.issues.map((issue) => issue.message)));
    }
    parsed.push({
      row: headerIndex + offset + 2,
      title: text(cells.title),
      stepTitle: context.type === 'mission' ? text(cells.step) : '',
      dimensionTitle,
      question: checked,
      errors,
    });
  });

  if (parsed.length === 0) return { ok: false, error: 'هیچ سؤالی زیر سرستون‌ها نیست' };
  if (parsed.length > L.QUESTIONS_MAX) {
    return { ok: false, error: `حداکثر ${fa(L.QUESTIONS_MAX)} سؤال در هر فعالیت` };
  }
  return { ok: true, rows: parsed };
}

/** The template's example rows, one per kind, for the downloadable file. */
export const QUESTION_IMPORT_EXAMPLES: Partial<Record<ColumnKey, string>>[] = [
  { type: 'تک‌گزینه‌ای', title: 'بیشتر کتاب می‌خونی یا فیلم می‌بینی؟', required: 'بله', options: 'کتاب | فیلم | هر دو' },
  { type: 'چندگزینه‌ای', title: 'کدوم ژانرها رو دوست داری؟', options: 'فانتزی | تاریخی | جنایی', maxSelections: '2' },
  { type: 'امتیازی', title: 'چقدر از خوندن لذت می‌بری؟', range: '5' },
  { type: 'طیفی', title: 'از جمع انرژی می‌گیرم', range: '1-5', minLabel: 'اصلاً', maxLabel: 'کاملاً' },
  { type: 'متنی', title: 'آخرین کتابی که خوندی چی بود؟', required: 'خیر' },
];
