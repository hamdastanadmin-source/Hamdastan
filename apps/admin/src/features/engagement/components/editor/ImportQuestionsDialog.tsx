'use client';

import { QUESTION_KIND_LABELS } from '@hamdastan/config';
import type { ActivityDefinition, ActivityType } from '@hamdastan/types';
import {
  parseQuestionRows,
  QUESTION_IMPORT_COLUMNS,
  QUESTION_IMPORT_EXAMPLES,
  type ImportedQuestionRow,
} from '@hamdastan/validation';

import { SheetImportDialog } from '@/components';
import { downloadSheetTemplate } from '@/lib';

import { newKey } from '../../utils/draft';
import { mergeImported } from '../../utils/import';

const downloadTemplate = () =>
  downloadSheetTemplate({
    columns: QUESTION_IMPORT_COLUMNS,
    examples: QUESTION_IMPORT_EXAMPLES,
    sheet: 'سؤال‌ها',
    fileName: 'hamdastan-questions-template.xlsx',
    wide: 'title',
  });

/**
 * «ورود از اکسل» for an activity's questions: the valid rows are added after
 * the questions already there, and stay editable until the activity is
 * saved.
 */
export function ImportQuestionsDialog({
  open,
  onOpenChange,
  type,
  definition,
  targetStep,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ActivityType;
  definition: ActivityDefinition;
  /** A journey: the day rows without a matching «مرحله» go to. */
  targetStep?: number;
  onImport: (definition: ActivityDefinition, added: number) => void;
}) {
  return (
    <SheetImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ورود سؤال‌ها از اکسل"
      description="هر سطر فایل یک سؤال است. سؤال‌ها پس از سؤال‌های فعلی اضافه می‌شوند و پیش از ذخیره قابل ویرایش‌اند."
      noun="سؤال"
      heads={{ tag: 'نوع', label: 'سؤال' }}
      columns={QUESTION_IMPORT_COLUMNS}
      onDownloadTemplate={downloadTemplate}
      parse={(sheet) => {
        const result = parseQuestionRows(sheet, { type, mode: definition.assessment?.mode, newId: newKey });
        if (!result.ok) return result;
        return {
          ok: true,
          rows: result.rows.map((row): ImportedQuestionRow & { label: string; tag?: string } => ({
            ...row,
            label: row.title,
            tag: row.question ? QUESTION_KIND_LABELS[row.question.kind] : undefined,
          })),
        };
      }}
      onApply={(rows) => {
        const merged = mergeImported(definition, type, rows, targetStep);
        if ('error' in merged) return merged.error;
        onImport(merged.definition, merged.added);
      }}
    />
  );
}
