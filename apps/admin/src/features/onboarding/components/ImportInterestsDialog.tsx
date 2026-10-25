'use client';

import { toast } from 'sonner';

import type { InterestCategory } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  INTEREST_IMPORT_COLUMNS,
  INTEREST_IMPORT_EXAMPLES,
  parseInterestRows,
  toInterestImport,
} from '@hamdastan/validation';

import { SheetImportDialog } from '@/components';
import { downloadSheetTemplate } from '@/lib';
import { adminOnboardingService } from '@/services';

const downloadTemplate = () =>
  downloadSheetTemplate({
    columns: INTEREST_IMPORT_COLUMNS,
    examples: INTEREST_IMPORT_EXAMPLES,
    sheet: 'علاقه‌مندی‌ها',
    fileName: 'hamdastan-interests-template.xlsx',
    wide: 'interest',
  });

/**
 * «ورود از اکسل» for stage 1: one interest per row. A row whose category
 * matches one in the catalog joins it; any other category is created. The
 * valid rows are saved in one request — all of them or none.
 */
export function ImportInterestsDialog({
  open,
  onOpenChange,
  catalog,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is there now, so a row repeating an existing interest is flagged before saving. */
  catalog: readonly InterestCategory[];
  onImported: () => void;
}) {
  return (
    <SheetImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ورود علاقه‌مندی‌ها از اکسل"
      description="هر سطر فایل یک علاقه‌مندی است. اگر دسته از قبل وجود داشته باشد علاقه‌مندی به انتهای آن اضافه می‌شود، وگرنه دسته‌ی تازه ساخته می‌شود."
      noun="علاقه‌مندی"
      heads={{ tag: 'دسته', label: 'علاقه‌مندی' }}
      columns={INTEREST_IMPORT_COLUMNS}
      onDownloadTemplate={downloadTemplate}
      parse={(sheet) => {
        const result = parseInterestRows(sheet, catalog);
        if (!result.ok) return result;
        return { ok: true, rows: result.rows.map((row) => ({ ...row, tag: row.category, label: row.interest })) };
      }}
      onApply={async (rows) => {
        await adminOnboardingService.importInterests(toInterestImport(rows));
        toast.success(`${toPersianDigits(rows.length)} علاقه‌مندی اضافه شد`);
        onImported();
      }}
    />
  );
}
