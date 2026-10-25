/**
 * The onboarding catalogs from a spreadsheet — interests and questionnaire
 * questions, one row each. Pure, like `engagement-import.ts`: rows of cells
 * in, one entry per non-empty row out — what it becomes, or why it will not
 * do — so the admin sees every problem by row number before anything is
 * saved. The request the panel then sends is validated again by the API.
 */

import {
  QUESTIONNAIRE_KIND_LABELS,
  QUESTIONNAIRE_SECTION_LABELS,
  type InterestCategory,
  type QuestionKind,
  type SectionId,
} from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { QuestionInput } from '@hamdastan/types';

import { z } from 'zod';

import { questionInputSchema } from './questionnaire';
import { sheetInteger, sheetKey, sheetList, sheetRecords, sheetText, type SheetCell } from './sheet';

type ImportResult<Row> = { ok: true; rows: Row[] } | { ok: false; error: string };

const LABEL_MAX = 80;
/** A bound on one file, not a product limit. */
const INTEREST_ROWS_MAX = 500;
const QUESTION_ROWS_MAX = 100;

// ─── Interests ───────────────────────────────────────────────────────────────

export const INTEREST_IMPORT_COLUMNS = [
  { key: 'category', title: 'دسته', hint: 'الزامی — اگر دسته‌ای با همین عنوان هست، علاقه‌مندی به آن اضافه می‌شود؛ وگرنه دسته‌ی تازه ساخته می‌شود' },
  { key: 'interest', title: 'علاقه‌مندی', hint: 'الزامی — یک علاقه‌مندی در هر سطر' },
] as const;

export const INTEREST_IMPORT_EXAMPLES = [
  { category: 'ورزش‌های آبی', interest: 'شنا' },
  { category: 'ورزش‌های آبی', interest: 'غواصی' },
  { category: 'موسیقی و اجرا', interest: 'جاز' },
];

export type ImportedInterestRow = { row: number; category: string; interest: string; errors: string[] };

/**
 * One interest per row. A row is refused when a cell is missing or too long,
 * when it repeats an earlier row, or when its category already has that
 * interest in `catalog`.
 */
export function parseInterestRows(rows: SheetCell[][], catalog: readonly InterestCategory[]): ImportResult<ImportedInterestRow> {
  const sheet = sheetRecords(rows, INTEREST_IMPORT_COLUMNS, 'interest');
  if (!sheet.ok) return sheet;
  if (sheet.records.length > INTEREST_ROWS_MAX) return { ok: false, error: `حداکثر ${toPersianDigits(INTEREST_ROWS_MAX)} سطر در هر فایل` };

  const existing = new Set(
    catalog.flatMap((category) => category.interests.map((interest) => `${sheetKey(category.title)}/${sheetKey(interest.label)}`))
  );
  const seen = new Set<string>();

  return {
    ok: true,
    rows: sheet.records.map(({ row, cells }) => {
      const category = sheetText(cells.category);
      const interest = sheetText(cells.interest);
      const errors: string[] = [];
      if (!category) errors.push('دسته خالی است');
      if (!interest) errors.push('علاقه‌مندی خالی است');
      if (category.length > LABEL_MAX || interest.length > LABEL_MAX) errors.push(`حداکثر ${toPersianDigits(LABEL_MAX)} نویسه`);

      const key = `${sheetKey(category)}/${sheetKey(interest)}`;
      if (errors.length === 0 && existing.has(key)) errors.push('این علاقه‌مندی از قبل در همین دسته هست');
      else if (errors.length === 0 && seen.has(key)) errors.push('در فایل تکراری است');
      seen.add(key);
      return { row, category, interest, errors };
    }),
  };
}

/** The valid rows as the import request: categories in first-seen order, their interests in row order. */
export function toInterestImport(rows: readonly ImportedInterestRow[]): InterestImportInput {
  const byKey = new Map<string, { title: string; interests: string[] }>();
  for (const { category, interest, errors } of rows) {
    if (errors.length > 0) continue;
    const entry = byKey.get(sheetKey(category)) ?? { title: category, interests: [] };
    entry.interests.push(interest);
    byKey.set(sheetKey(category), entry);
  }
  return { categories: [...byKey.values()] };
}

const label = z.string().trim().min(1).max(LABEL_MAX);

/** `POST /admin/onboarding/interest-categories/import`. Matching titles to categories is the API's job. */
export const interestImportSchema = z.object({
  categories: z
    .array(z.object({ title: label, interests: z.array(label).min(1).max(INTEREST_ROWS_MAX) }))
    .min(1, { error: 'هیچ علاقه‌مندی‌ای برای افزودن نیست' })
    .max(INTEREST_ROWS_MAX),
});

export type InterestImportInput = z.infer<typeof interestImportSchema>;

// ─── Questions ───────────────────────────────────────────────────────────────

const KIND_NAMES = Object.entries(QUESTIONNAIRE_KIND_LABELS) as [QuestionKind, string][];
const SECTION_NAMES = Object.entries(QUESTIONNAIRE_SECTION_LABELS).map(([id, name]) => [Number(id) as SectionId, name] as const);

export const QUESTIONNAIRE_IMPORT_COLUMNS = [
  { key: 'section', title: 'بخش', hint: `۱ تا ۴ یا نام بخش: ${SECTION_NAMES.map(([, name]) => name).join('، ')}` },
  { key: 'kind', title: 'نوع', hint: KIND_NAMES.map(([, name]) => name).join('، ') },
  { key: 'title', title: 'متن سؤال', hint: 'الزامی' },
  { key: 'helper', title: 'راهنما', hint: 'اختیاری' },
  { key: 'options', title: 'گزینه‌ها', hint: 'با | جدا کنید: صبح | ظهر | شب — طیف ندارد' },
  { key: 'maxSelections', title: 'سقف انتخاب', hint: 'اختیاری؛ فقط چندانتخابی و رتبه‌بندی' },
  { key: 'minLabel', title: 'برچسب ابتدا', hint: 'فقط طیف — کنار ۱' },
  { key: 'maxLabel', title: 'برچسب انتها', hint: 'فقط طیف — کنار ۱۰' },
] as const;

export const QUESTIONNAIRE_IMPORT_EXAMPLES = [
  { section: '1', kind: 'تک‌انتخابی', title: 'آخر هفته‌ها بیشتر کجایی؟', options: 'بیرون از شهر | خونه | کافه' },
  { section: 'سبک ارتباط', kind: 'چندانتخابی', title: 'از چه موضوع‌هایی حرف زدن رو دوست داری؟', options: 'فیلم | سفر | کار', maxSelections: '2' },
  { section: '3', kind: 'طیف ۱ تا ۱۰', title: 'چقدر اهل ریسک هستی؟', minLabel: 'اصلاً', maxLabel: 'خیلی زیاد' },
];

export type ImportedQuestionnaireRow = { row: number; title: string; question: QuestionInput | null; errors: string[] };

const KIND_BY_NAME = new Map<string, QuestionKind>([
  ...KIND_NAMES.map(([kind, name]) => [sheetKey(name), kind] as const),
  ...KIND_NAMES.map(([kind]) => [kind, kind] as const),
  ['تکگزینهای', 'single'],
  ['چندگزینهای', 'multi'],
  ['رتبهبندی', 'ranked'],
  ['طیف', 'slider'],
  ['طیفی', 'slider'],
]);

function sectionOf(cell: SheetCell): SectionId | null {
  const n = sheetInteger(cell);
  // Not a number (NaN) means it may be a section's name.
  if (n !== null && !Number.isNaN(n)) return n >= 1 && n <= 4 ? (n as SectionId) : null;
  return SECTION_NAMES.find(([, name]) => sheetKey(name) === sheetKey(cell))?.[0] ?? null;
}

/** One question per row, each checked with the same `questionInputSchema` the panel's form and the API use. */
export function parseQuestionnaireRows(rows: SheetCell[][]): ImportResult<ImportedQuestionnaireRow> {
  const sheet = sheetRecords(rows, QUESTIONNAIRE_IMPORT_COLUMNS, 'title');
  if (!sheet.ok) return sheet;
  if (sheet.records.length > QUESTION_ROWS_MAX) return { ok: false, error: `حداکثر ${toPersianDigits(QUESTION_ROWS_MAX)} سؤال در هر فایل` };

  return {
    ok: true,
    rows: sheet.records.map(({ row, cells }) => {
      const title = sheetText(cells.title);
      const errors: string[] = [];
      const section = sectionOf(cells.section);
      if (!section) errors.push(`بخش «${toPersianDigits(sheetText(cells.section))}» شناخته نشد؛ ۱ تا ۴ یا نام بخش`);
      const kind = KIND_BY_NAME.get(sheetKey(cells.kind));
      if (!kind) errors.push(`نوع «${sheetText(cells.kind)}» شناخته نشد؛ نوع‌های مجاز: ${KIND_NAMES.map(([, name]) => name).join('، ')}`);
      const maxSelections = sheetInteger(cells.maxSelections);
      if (Number.isNaN(maxSelections)) errors.push('سقف انتخاب باید عدد باشد');
      if (errors.length > 0 || !section || !kind) return { row, title, question: null, errors };

      const parsed = questionInputSchema.safeParse({
        section,
        kind,
        title,
        helper: sheetText(cells.helper) || null,
        maxSelections,
        minLabel: sheetText(cells.minLabel) || null,
        maxLabel: sheetText(cells.maxLabel) || null,
        options: sheetList(cells.options).map((option) => ({ label: option })),
      });
      return parsed.success
        ? { row, title, question: parsed.data, errors }
        : { row, title, question: null, errors: [...new Set(parsed.error.issues.map((issue) => issue.message))] };
    }),
  };
}

/** `POST /admin/onboarding/questions/import`. */
export const questionnaireImportSchema = z.object({
  questions: z.array(questionInputSchema).min(1, { error: 'هیچ سؤالی برای افزودن نیست' }).max(QUESTION_ROWS_MAX),
});

/** As the panel sends it; the API parses it into `QuestionInputBody`s. */
export type QuestionnaireImportInput = z.input<typeof questionnaireImportSchema>;
