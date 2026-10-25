/**
 * Reading a spreadsheet's rows, however the file was read: the cell helpers
 * and the header matching every Excel import shares (Engagement Studio's
 * questions, the onboarding catalogs).
 *
 * A header is recognised by its title, so column order and extra columns do
 * not matter; the first non-empty row is the header and empty rows are
 * skipped. Row numbers are the spreadsheet's own (the header row counted).
 */

import { normalizePersianText, toLatinDigits } from '@hamdastan/shared/format/persian';

export type SheetCell = string | number | boolean | Date | null | undefined;

/** A cell as trimmed text, with Persian letters and Latin digits. */
export const sheetText = (cell: SheetCell) =>
  cell === null || cell === undefined ? '' : normalizePersianText(cell instanceof Date ? cell.toISOString() : String(cell));

/** A header or a name as compared: no spaces or ZWNJ, so «متن سوال» and «متن‌ سؤال» match. */
export const sheetKey = (cell: SheetCell) => sheetText(cell).replace(/[\s‌]/g, '').replace(/ؤ/g, 'و').toLowerCase();

/** «a | b | c», or one per line in the cell. */
export const sheetList = (cell: SheetCell) =>
  sheetText(cell) === ''
    ? []
    : String(cell)
        .split(/[|\n]/)
        .map((part) => normalizePersianText(part))
        .filter(Boolean);

/** An integer, null when empty, NaN when it is not one. */
export function sheetInteger(cell: SheetCell): number | null {
  const value = sheetText(cell);
  if (!value) return null;
  const n = Number(toLatinDigits(value));
  return Number.isInteger(n) ? n : NaN;
}

export type SheetColumn<K extends string> = { key: K; title: string; hint: string };

/** One data row: its spreadsheet number and its cells by column key. */
export type SheetRecord<K extends string> = { row: number; cells: Record<K, SheetCell> };

/**
 * Rows of cells → records keyed by column. Fails, with a message for the
 * admin, when the sheet is empty, the `required` column is missing, or there
 * is no data under the header.
 */
export function sheetRecords<K extends string>(
  rows: SheetCell[][],
  columns: readonly SheetColumn<K>[],
  required: K
): { ok: true; records: SheetRecord<K>[] } | { ok: false; error: string } {
  const headerIndex = rows.findIndex((row) => row.some((cell) => sheetText(cell) !== ''));
  if (headerIndex === -1) return { ok: false, error: 'فایل خالی است' };

  const keyByHeader = new Map(columns.map((column) => [sheetKey(column.title), column.key]));
  const keys = rows[headerIndex].map((cell) => keyByHeader.get(sheetKey(cell)));
  if (!keys.includes(required)) {
    const title = columns.find((column) => column.key === required)!.title;
    return { ok: false, error: `ستون «${title}» پیدا نشد. از فایل نمونه استفاده کنید.` };
  }

  const records: SheetRecord<K>[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (!row.some((cell) => sheetText(cell) !== '')) return;
    const cells = Object.fromEntries(columns.map(({ key }) => [key, row[keys.indexOf(key)]])) as Record<K, SheetCell>;
    records.push({ row: headerIndex + offset + 2, cells });
  });
  if (records.length === 0) return { ok: false, error: 'زیر سرستون‌ها هیچ سطری وجود ندارد' };
  return { ok: true, records };
}
