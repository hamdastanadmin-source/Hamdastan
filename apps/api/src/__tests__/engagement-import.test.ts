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
  it('reads a matching question from «مورد = جفت» pairs, and refuses a malformed pair', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'تطبیقی', title: 'وصل کن', option1: 'الف = ۱', option2: 'ب = ۲', option3: 'ج = ۳', option4: 'د = ۴' }),
        row({ type: 'تطبیقی', title: 'ناقص', option1: 'الف = ۱', option2: 'ب', option3: 'ج = ۳', option4: 'د = ۴' }),
      ],
      { type: 'survey', newId }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors).toEqual([]);
    expect(result.rows[0].question).toMatchObject({ kind: 'matching', pairs: [{ prompt: 'الف', match: '1' }, {}, {}, {}] });
    expect(result.rows[1].question).toBeNull();
  });

  it('reads every kind, with Persian digits and one column per option', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'تک‌گزینه‌ای', title: 'کتاب یا فیلم؟', option1: 'کتاب', option2: 'فیلم' }),
        row({ type: 'چندگزینه‌ای', title: 'ژانرها؟', option1: 'الف', option2: 'ب', option4: 'ج', maxSelections: '۲' }),
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
      [['یادداشت', 'گزینه 2', 'متن سوال', 'گزینه1'], ['x', 'نه', 'موافقی؟', 'آره']],
      { type: 'survey', newId }
    );
    expect(result.ok && result.rows[0].question).toMatchObject({ kind: 'single', title: 'موافقی؟', options: [{ label: 'آره' }, { label: 'نه' }] });
  });

  it('reports each bad row by number, and keeps the good ones', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'چیزی', title: 'نوع ناشناخته' }),
        row({ type: 'تک‌گزینه‌ای', title: 'یک گزینه', option1: 'تنها' }),
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
        row({ type: 'تک‌گزینه‌ای', title: 'مدرسه؟', option1: 'هاگوارتز', option2: 'دورمسترانگ', correct: 'هاگوارتز' }),
        row({ type: 'چندگزینه‌ای', title: 'کدوما؟', option1: 'الف', option2: 'ب', option3: 'ج', correct: '1 | 3' }),
        row({ type: 'تک‌گزینه‌ای', title: 'غلط', option1: 'الف', option2: 'ب', correct: 'د' }),
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

  it('reads personality scores per option, toward the row\'s dimension or named ones', () => {
    const result = parseQuestionRows(
      [
        header,
        row({ type: 'طیفی', title: 'جمع', range: '1-5', dimension: 'اجتماعی', reverse: 'بله' }),
        row({ type: 'تک‌گزینه‌ای', title: 'برنامه', option1: 'کم', option2: 'زیاد', score1: '0', score2: '۴', dimension: 'منظم' }),
        row({ type: 'تک‌گزینه‌ای', title: 'آخر هفته', option1: 'مهمونی', option2: 'کتاب', score1: 'اجتماعی = 3 | منظم = -1', score2: 'منظم = 2' }),
        row({ type: 'امتیازی', title: 'بی‌بعد' }),
        row({ type: 'تک‌گزینه‌ای', title: 'بی‌امتیاز', option1: 'الف', option2: 'ب', score1: '2' }),
        row({ type: 'تک‌گزینه‌ای', title: 'بیرون از بازه', option1: 'الف', option2: 'ب', score1: 'منظم = 11', score3: '1' }),
      ],
      { type: 'assessment', mode: 'personality', newId }
    );
    if (!result.ok) throw new Error(result.error);
    const [scale, single, multi, unnamed, noDimension, outOfRange] = result.rows;
    expect(scale.dimensions.map((d) => d.title)).toEqual(['اجتماعی']);
    expect(scale.question).toMatchObject({ reverse: true, dimensionId: scale.dimensions[0].id });

    const organised = single.dimensions[0].id;
    expect(single.question).toMatchObject({ options: [{}, { dimensionScores: { [organised]: 4 } }] });
    expect(single.question && 'options' in single.question && single.question.options[0].dimensionScores).toBeUndefined();

    const id = (title: string) => multi.dimensions.find((d) => d.title === title)!.id;
    expect(multi.question).toMatchObject({
      options: [{ dimensionScores: { [id('اجتماعی')]: 3, [id('منظم')]: -1 } }, { dimensionScores: { [id('منظم')]: 2 } }],
    });

    expect(unnamed.errors[0]).toContain('بُعد');
    expect(noDimension.errors[0]).toContain('«بُعد»');
    expect(outOfRange.errors).toHaveLength(3);
  });

  it('groups a mission by its step column, and refuses a file without a title column', () => {
    const result = parseQuestionRows([header, row({ type: 'متنی', title: 'مدرک', step: 'بخون' })], { type: 'mission', newId });
    expect(result.ok && result.rows[0].stepTitle).toBe('بخون');
    expect(parseQuestionRows([['نوع'], ['متنی']], { type: 'survey', newId })).toMatchObject({ ok: false });
    expect(parseQuestionRows([], { type: 'survey', newId })).toMatchObject({ ok: false });
  });
});
