import { QUESTION_IMPORT_COLUMNS, QUESTION_IMPORT_EXAMPLES } from '@hamdastan/validation';

/**
 * Reading and writing the question spreadsheet — in the browser, on the
 * admin's own file. Nothing is sent anywhere: the rows are handed to
 * `parseQuestionRows` (`@hamdastan/validation`) and the questions travel to
 * `apps/api` only when the activity is saved, like any typed in.
 *
 * Both libraries are loaded on demand, so the builder does not carry them
 * until someone opens the import.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** The first sheet's rows, as cells. */
export async function readQuestionSheet(file: File): Promise<(string | number | boolean | Date | null)[][]> {
  const { readSheet } = await import('read-excel-file/browser');
  return (await readSheet(file)) as (string | number | boolean | Date | null)[][];
}

/**
 * The template: bold headers and one example row per kind. What each column
 * takes is explained in the import dialog — a guidance row in the sheet
 * would be read back as a question.
 */
export async function downloadQuestionTemplate(): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = QUESTION_IMPORT_COLUMNS.map((column) => ({ value: column.title, fontWeight: 'bold' as const }));
  const examples = QUESTION_IMPORT_EXAMPLES.map((example) =>
    QUESTION_IMPORT_COLUMNS.map((column) => ({ value: example[column.key] ?? '' }))
  );
  await writeXlsxFile([header, ...examples], {
    sheet: 'سؤال‌ها',
    rightToLeft: true,
    stickyRowsCount: 1,
    columns: QUESTION_IMPORT_COLUMNS.map((column) => ({ width: column.key === 'title' ? 40 : 18 })),
  }).toFile('hamdastan-questions-template.xlsx');
}
