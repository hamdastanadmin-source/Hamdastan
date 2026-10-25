'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, FileSpreadsheet, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { QUESTIONNAIRE_KIND_LABELS, QUESTIONNAIRE_SECTION_LABELS } from '@hamdastan/config';
import type { AdminQuestion, QuestionInput } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { useOrderedList } from '@/hooks';
import { errorMessage, formatCount } from '@/lib';
import { adminOnboardingService } from '@/services';

import { SECTIONS } from '../utils/labels';
import { DeleteDialog } from './DeleteDialog';
import { ImportQuestionsDialog } from './ImportQuestionsDialog';
import { QuestionFormDialog } from './QuestionFormDialog';

const load = () => adminOnboardingService.questions();
const reorder = (ids: string[]) => adminOnboardingService.reorderQuestions(ids);

/**
 * Stage 2's questions, a card per section in the order they are asked —
 * add, edit, move within a section, delete. The scored questions feed the
 * social profile: they can be reworded and moved, not deleted.
 *
 * The list is ordered by section, then position, so a question's
 * neighbours in its section are its neighbours in the list: moving one
 * place is a swap with the next row of the same section.
 */
export function QuestionsPanel() {
  const { items, error, loading, reload, move } = useOrderedList(load, reorder);
  const [editing, setEditing] = useState<AdminQuestion | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminQuestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);

  const save = async (input: QuestionInput) => {
    if (editing === 'new') await adminOnboardingService.createQuestion(input);
    else if (editing) await adminOnboardingService.updateQuestion(editing.id, input);
    reload();
  };

  const onMove = async (id: string, by: -1 | 1) => {
    try {
      await move(id, by);
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminOnboardingService.removeQuestion(deleting.id);
      toast.success('سؤال حذف شد');
      setDeleting(null);
      reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          سؤال‌های «امتیازدار» پروفایل اجتماعی را می‌سازند و حذف‌شدنی نیستند؛ پاسخ سؤال‌های تازه ذخیره می‌شود ولی امتیاز نمی‌گیرد.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileSpreadsheet aria-hidden="true" />
            ورود از اکسل
          </Button>
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" />
            سؤال جدید
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>سؤال‌ها بارگذاری نشد</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
              تلاش دوباره
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        SECTIONS.map((section) => {
          const rows = items?.filter((question) => question.section === section) ?? [];
          return (
            <Card key={section} className="gap-0 py-0">
              <CardHeader className="border-b py-4">
                <CardTitle className="text-base">
                  بخش {toPersianDigits(section)}: {QUESTIONNAIRE_SECTION_LABELS[section]}
                </CardTitle>
              </CardHeader>
              <Table aria-busy={loading}>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4">سؤال</TableHead>
                    <TableHead>نوع</TableHead>
                    <TableHead className="hidden sm:table-cell">ترتیب</TableHead>
                    <TableHead className="pe-4 text-end">
                      <span className="sr-only">عملیات</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading &&
                    Array.from({ length: 3 }, (_, row) => (
                      <TableRow key={row}>
                        {Array.from({ length: 4 }, (_, cell) => (
                          <TableCell key={cell}>
                            <Skeleton className="h-5 w-full max-w-28" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {items && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-muted-foreground">
                        این بخش سؤالی ندارد
                      </TableCell>
                    </TableRow>
                  )}

                  {rows.map((question, index) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-md ps-4 whitespace-normal">
                        <span className="font-medium">{question.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {question.kind === 'slider'
                            ? `${question.minLabel} تا ${question.maxLabel}`
                            : `${formatCount(question.options.length)} گزینه`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{QUESTIONNAIRE_KIND_LABELS[question.kind]}</Badge>
                          {question.scored && <Badge variant="secondary">امتیازدار</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === 0}
                            onClick={() => onMove(question.id, -1)}
                            aria-label="بالا بردن سؤال"
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={index === rows.length - 1}
                            onClick={() => onMove(question.id, 1)}
                            aria-label="پایین بردن سؤال"
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="pe-4 text-end">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(question)} aria-label="ویرایش سؤال">
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={question.scored}
                            title={question.scored ? 'سؤال امتیازدار حذف‌شدنی نیست' : undefined}
                            onClick={() => setDeleting(question)}
                            aria-label="حذف سؤال"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          );
        })
      )}

      {editing && (
        <QuestionFormDialog
          key={editing === 'new' ? 'new' : editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          question={editing === 'new' ? undefined : editing}
          onSubmit={save}
        />
      )}

      <ImportQuestionsDialog open={importing} onOpenChange={setImporting} onImported={reload} />

      <DeleteDialog
        title={deleting && 'حذف سؤال'}
        description={deleting ? `«${deleting.title}» از پرسش‌نامه حذف می‌شود. پاسخ‌هایی که تاکنون داده شده در سابقه می‌ماند.` : ''}
        busy={busy}
        onConfirm={() => void remove()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
