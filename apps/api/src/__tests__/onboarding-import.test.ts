import { describe, expect, it } from 'vitest';

import type { InterestCategory } from '@hamdastan/config';
import {
  INTEREST_IMPORT_COLUMNS,
  INTEREST_IMPORT_EXAMPLES,
  parseInterestRows,
  parseQuestionnaireRows,
  QUESTIONNAIRE_IMPORT_COLUMNS,
  QUESTIONNAIRE_IMPORT_EXAMPLES,
  toInterestImport,
} from '@hamdastan/validation';

/**
 * The onboarding catalogs' Excel import, as plain functions: the panel
 * reads the file in the browser and hands the rows to these.
 */

const CATALOG: InterestCategory[] = [{ id: 'music', title: 'موسیقی و اجرا', interests: [{ id: 'concert', label: 'کنسرت' }] }];

const interestHeader = INTEREST_IMPORT_COLUMNS.map((column) => column.title);
const questionHeader = QUESTIONNAIRE_IMPORT_COLUMNS.map((column) => column.title);
const questionRow = (cells: Partial<Record<(typeof QUESTIONNAIRE_IMPORT_COLUMNS)[number]['key'], string | number>>) =>
  QUESTIONNAIRE_IMPORT_COLUMNS.map((column) => cells[column.key] ?? null);

describe('parseInterestRows', () => {
  it('reads one interest per row and groups them by category, in first-seen order', () => {
    const result = parseInterestRows(
      [interestHeader, ['ورزش آبی', 'شنا'], [], ['موسیقی و اجرا', 'جاز'], ['ورزش آبی', 'غواصی']],
      CATALOG
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map(({ row }) => row)).toEqual([2, 4, 5]);
    expect(toInterestImport(result.rows)).toEqual({
      categories: [
        { title: 'ورزش آبی', interests: ['شنا', 'غواصی'] },
        { title: 'موسیقی و اجرا', interests: ['جاز'] },
      ],
    });
  });

  it('refuses empty cells, repeats, and an interest the category already has — matching titles loosely', () => {
    const result = parseInterestRows(
      [['علاقه مندی', 'دسته'], ['شنا', ''], ['کنسرت', 'موسیقی  و اجرا'], ['شنا', 'آب'], ['شنا', 'آب']],
      CATALOG
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map(({ errors }) => errors)).toEqual([
      ['دسته خالی است'],
      ['این علاقه‌مندی از قبل در همین دسته هست'],
      [],
      ['در فایل تکراری است'],
    ]);
    expect(toInterestImport(result.rows).categories).toEqual([{ title: 'آب', interests: ['شنا'] }]);
  });

  it('needs the interest column, and a row under it', () => {
    expect(parseInterestRows([['دسته'], ['آب']], CATALOG)).toMatchObject({ ok: false });
    expect(parseInterestRows([interestHeader], CATALOG)).toMatchObject({ ok: false });
  });

  it('accepts its own template', () => {
    const rows = [interestHeader, ...INTEREST_IMPORT_EXAMPLES.map((example) => [example.category, example.interest])];
    const result = parseInterestRows(rows, []);
    expect(result.ok && result.rows.every(({ errors }) => errors.length === 0)).toBe(true);
  });
});

describe('parseQuestionnaireRows', () => {
  it('reads every kind, a section by number or name, Persian digits and «|» options', () => {
    const result = parseQuestionnaireRows([
      questionHeader,
      questionRow({ section: '۱', kind: 'تک‌انتخابی', title: 'صبح یا شب؟', options: 'صبح | شب' }),
      questionRow({ section: 'سبک ارتباط', kind: 'چندانتخابی', title: 'موضوع‌ها؟', options: 'الف|ب|ج', maxSelections: '۲' }),
      questionRow({ section: 4, kind: 'رتبه‌بندی', title: 'مهم‌ترین؟', options: 'الف | ب' }),
      questionRow({ section: 3, kind: 'طیف', title: 'ریسک؟', minLabel: 'کم', maxLabel: 'زیاد', options: 'نادیده' }),
    ]);
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map(({ errors }) => errors)).toEqual([[], [], [], []]);
    expect(result.rows.map(({ question }) => question)).toEqual([
      { section: 1, kind: 'single', title: 'صبح یا شب؟', helper: null, maxSelections: null, minLabel: null, maxLabel: null, options: [{ label: 'صبح' }, { label: 'شب' }] },
      expect.objectContaining({ section: 2, kind: 'multi', maxSelections: 2 }),
      expect.objectContaining({ section: 4, kind: 'ranked' }),
      { section: 3, kind: 'slider', title: 'ریسک؟', helper: null, maxSelections: null, minLabel: 'کم', maxLabel: 'زیاد', options: [] },
    ]);
  });

  it('says what is wrong with each refused row', () => {
    const result = parseQuestionnaireRows([
      questionHeader,
      questionRow({ section: 5, kind: 'تک‌انتخابی', title: 'الف', options: 'a|b' }),
      questionRow({ section: 1, kind: 'نامعلوم', title: 'ب', options: 'a|b' }),
      questionRow({ section: 1, kind: 'تک‌انتخابی', title: 'ج', options: 'فقط یکی' }),
      questionRow({ section: 1, kind: 'طیف', title: 'د' }),
      questionRow({ section: 1, kind: 'چندانتخابی', title: 'ه', options: 'a|b', maxSelections: 'زیاد' }),
    ]);
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.every(({ question }) => question === null)).toBe(true);
    expect(result.rows[0].errors[0]).toMatch(/^بخش «۵»/);
    expect(result.rows[1].errors[0]).toMatch(/^نوع «نامعلوم»/);
    expect(result.rows[2].errors).toEqual(['دست‌کم دو گزینه لازم است']);
    expect(result.rows[3].errors).toEqual(['برچسب ابتدای بازه را وارد کنید', 'برچسب انتهای بازه را وارد کنید']);
    expect(result.rows[4].errors).toEqual(['سقف انتخاب باید عدد باشد']);
  });

  it('accepts its own template', () => {
    const rows = [questionHeader, ...QUESTIONNAIRE_IMPORT_EXAMPLES.map((example) => questionRow(example))];
    const result = parseQuestionnaireRows(rows);
    expect(result.ok && result.rows.every(({ question }) => question !== null)).toBe(true);
  });
});
