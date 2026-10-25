'use client';

import { toast } from 'sonner';

import { QUESTIONNAIRE_KIND_LABELS, QUESTIONNAIRE_SECTION_LABELS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  parseQuestionnaireRows,
  QUESTIONNAIRE_IMPORT_COLUMNS,
  QUESTIONNAIRE_IMPORT_EXAMPLES,
} from '@hamdastan/validation';

import { SheetImportDialog } from '@/components';
import { downloadSheetTemplate } from '@/lib';
import { adminOnboardingService } from '@/services';

const downloadTemplate = () =>
  downloadSheetTemplate({
    columns: QUESTIONNAIRE_IMPORT_COLUMNS,
    examples: QUESTIONNAIRE_IMPORT_EXAMPLES,
    sheet: 'پرسش‌نامه',
    fileName: 'hamdastan-questionnaire-template.xlsx',
    wide: 'title',
  });

/**
 * «ورود از اکسل» for the questionnaire: one question per row, each added at
 * the end of its section and not scored, like one added by hand. The valid
 * rows are saved in one request — all of them or none.
 */
export function ImportQuestionsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  return (
    <SheetImportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="ورود سؤال‌ها از اکسل"
      description="هر سطر فایل یک سؤال است و به انتهای بخش خودش اضافه می‌شود. سؤال‌های واردشده امتیاز نمی‌گیرند و بعداً قابل ویرایش‌اند."
      noun="سؤال"
      heads={{ tag: 'بخش و نوع', label: 'سؤال' }}
      columns={QUESTIONNAIRE_IMPORT_COLUMNS}
      onDownloadTemplate={downloadTemplate}
      parse={(sheet) => {
        const result = parseQuestionnaireRows(sheet);
        if (!result.ok) return result;
        return {
          ok: true,
          rows: result.rows.map((row) => ({
            ...row,
            label: row.title,
            tag: row.question
              ? `${QUESTIONNAIRE_SECTION_LABELS[row.question.section]} · ${QUESTIONNAIRE_KIND_LABELS[row.question.kind]}`
              : undefined,
          })),
        };
      }}
      onApply={async (rows) => {
        await adminOnboardingService.importQuestions({ questions: rows.flatMap((row) => (row.question ? [row.question] : [])) });
        toast.success(`${toPersianDigits(rows.length)} سؤال اضافه شد`);
        onImported();
      }}
    />
  );
}
