import type { SheetCell, SheetColumn } from '@hamdastan/validation';

/**
 * Reading and writing Excel files — in the browser, on the admin's own
 * file. Nothing is sent anywhere from here: the rows go to a parser in
 * `@hamdastan/validation`, and what it accepts travels to `apps/api` like
 * anything typed in.
 *
 * Both libraries are loaded on demand, so a screen does not carry them until
 * someone opens an import.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** The first sheet's rows, as cells. */
export async function readSheet(file: File): Promise<SheetCell[][]> {
  const { readSheet: read } = await import('read-excel-file/browser');
  return (await read(file)) as SheetCell[][];
}

/**
 * A template: bold headers and the example rows. What each column takes is
 * explained in the import dialog — a guidance row in the sheet would be read
 * back as data.
 */
export async function downloadSheetTemplate<K extends string>({
  columns,
  examples,
  sheet,
  fileName,
  wide,
}: {
  columns: readonly SheetColumn<K>[];
  examples: readonly Partial<Record<K, string>>[];
  sheet: string;
  fileName: string;
  /** The column that holds the long text, given more room. */
  wide: K;
}): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');
  const header = columns.map((column) => ({ value: column.title, fontWeight: 'bold' as const }));
  const rows = examples.map((example) => columns.map((column) => ({ value: example[column.key] ?? '' })));
  await writeXlsxFile([header, ...rows], {
    sheet,
    rightToLeft: true,
    stickyRowsCount: 1,
    columns: columns.map((column) => ({ width: column.key === wide ? 40 : 18 })),
  }).toFile(fileName);
}
