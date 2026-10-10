import { describe, expect, it } from 'vitest';

import { parseQuestionRows, QUESTION_IMPORT_COLUMNS } from '@hamdastan/validation';

/**
 * The Excel import's row mapping, as a plain function: the admin panel reads
 * the file in the browser and hands the rows to this.
 */

let counter = 0;
const newId = () => `id${++counter}`;
const header = QUESTION_IMPORT_COLUMNS.map((column) => column.title);
/** A row in template order, from just the columns given. */
const row = (cells: Partial<Record<(typeof QUESTION_IMPORT_COLUMNS)[number]['key'], string | number>>) =>
  QUESTION_IMPORT_COLUMNS.map((column) => cells[column.key] ?? null);

describe('parseQuestionRows', () => {
  it('reads every kind, with Persian digits and «|» options', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'تک‌گزینه‌ای', title: 'کتاب یا فیلم؟', options: 'کتاب | فیلم' }),
        row({ type: 'چندگزینه‌ای', title: 'ژانرها؟', options: 'الف|ب|ج', maxSelections: '۲' }),
        row({ type: 'امتیازی', title: 'چقدر؟', range: '۱۰' }),
        row({ type: 'طیفی', title: 'انرژی', range: '1-7', minLabel: 'کم', maxLabel: 'زیاد' }),
        [],
        row({ title: 'بدون نوع و گزینه', required: 'خیر' }),
      ],
      { type: 'survey', newId }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => [r.row, r.question?.kind, r.errors])).toEqual([
      [2, 'single', []],
      [3, 'multiple', []],
      [4, 'rating', []],
      [5, 'scale', []],
      [7, 'text', []],
    ]);
    expect(result.rows[1].question).toMatchObject({ maxSelections: 2, options: [{ label: 'الف' }, { label: 'ب' }, { label: 'ج' }] });
    expect(result.rows[4].question).toMatchObject({ required: false });
  });

  it('finds columns by their title, in any order, and ignores the rest', () => {
    const result = parseQuestionRows(
      [['یادداشت', 'گزینه‌ها', 'متن سوال'], ['x', 'آره | نه', 'موافقی؟']],
      { type: 'survey', newId }
    );
    expect(result.ok && result.rows[0].question).toMatchObject({ kind: 'single', title: 'موافقی؟' });
  });

  it('reports each bad row by number, and keeps the good ones', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'چیزی', title: 'نوع ناشناخته' }),
        row({ type: 'تک‌گزینه‌ای', title: 'یک گزینه', options: 'تنها' }),
        row({ type: 'متنی', title: '' }),
        row({ type: 'متنی', title: 'درست', required: 'شاید' }),
        row({ type: 'متنی', title: 'خوب' }),
      ],
      { type: 'survey', newId }
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.rows.map((r) => [r.row, r.question !== null, r.errors.length > 0])).toEqual([
      [2, false, true],
      [3, false, true],
      [4, false, true],
      [5, false, true],
      [6, true, false],
    ]);
  });

  it('reads the answer key by text or by number for a knowledge assessment', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'تک‌گزینه‌ای', title: 'مدرسه؟', options: 'هاگوارتز | دورمسترانگ', correct: 'هاگوارتز' }),
        row({ type: 'چندگزینه‌ای', title: 'کدوما؟', options: 'الف | ب | ج', correct: '1 | 3' }),
        row({ type: 'تک‌گزینه‌ای', title: 'غلط', options: 'الف | ب', correct: 'د' }),
      ],
      { type: 'assessment', mode: 'knowledge', newId }
    );
    if (!result.ok) throw new Error(result.error);
    const correct = (i: number) =>
      result.rows[i].question && 'options' in result.rows[i].question!
        ? (result.rows[i].question as { options: { correct?: boolean }[] }).options.map((o) => Boolean(o.correct))
        : null;
    expect(correct(0)).toEqual([true, false]);
    expect(correct(1)).toEqual([true, false, true]);
    expect(result.rows[2].errors[0]).toContain('«د»');
  });

  it('needs a dimension for every scored personality item, and reads scores and reverse', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'طیفی', title: 'جمع', range: '1-5', dimension: 'اجتماعی', reverse: 'بله' }),
        row({ type: 'تک‌گزینه‌ای', title: 'برنامه', options: 'کم | زیاد', scores: '0 | 4', dimension: 'منظم' }),
        row({ type: 'امتیازی', title: 'بی‌بعد' }),
      ],
      { type: 'assessment', mode: 'personality', newId }
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.rows[0]).toMatchObject({ dimensionTitle: 'اجتماعی', question: { reverse: true } });
    expect(result.rows[1].question).toMatchObject({ options: [{ score: 0 }, { score: 4 }] });
    expect(result.rows[2].errors[0]).toContain('بُعد');
  });

  it('groups a mission by its step column, and refuses a file without a title column', () => {
    const result = parseQuestionRows([header, row({ type: 'متنی', title: 'مدرک', step: 'بخون' })], { type: 'mission', newId });
    expect(result.ok && result.rows[0].stepTitle).toBe('بخون');
    expect(parseQuestionRows([['نوع'], ['متنی']], { type: 'survey', newId })).toMatchObject({ ok: false });
    expect(parseQuestionRows([], { type: 'survey', newId })).toMatchObject({ ok: false });
  });
});
