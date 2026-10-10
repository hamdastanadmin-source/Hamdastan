'use client';

import { useState } from 'react';
import { CircleAlert, CircleCheck, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { QUESTION_KIND_LABELS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ActivityDefinition, ActivityType } from '@hamdastan/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  ScrollArea,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';
import { parseQuestionRows, QUESTION_IMPORT_COLUMNS, type ImportedQuestionRow } from '@hamdastan/validation';

import { downloadQuestionTemplate, MAX_IMPORT_BYTES, readQuestionSheet } from '../../utils/excel';
import { newKey } from '../../utils/draft';
import { mergeImported } from '../../utils/import';

/**
 * «ورود از اکسل»: download the template, choose a file, see every row —
 * the question it becomes, or what is wrong with it, by row number — then
 * add the valid ones after the questions already there. Rows with errors
 * are left out and listed; nothing is dropped silently.
 */
export function ImportQuestionsDialog({
  open,
  onOpenChange,
  type,
  definition,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ActivityType;
  definition: ActivityDefinition;
  onImport: (definition: ActivityDefinition, added: number) => void;
}) {
  const [rows, setRows] = useState<ImportedQuestionRow[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const valid = rows?.filter((row) => row.question) ?? [];
  const invalid = rows?.filter((row) => !row.question) ?? [];

  const reset = () => {
    setRows(null);
    setFileError(null);
  };

  const read = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setFileError('فقط فایل اکسل ‎.xlsx‎ رو می‌شه خوند');
    if (file.size > MAX_IMPORT_BYTES) return setFileError('حجم فایل بیشتر از ۲ مگابایته');
    setReading(true);
    try {
      const sheet = await readQuestionSheet(file);
      const result = parseQuestionRows(sheet, { type, mode: definition.assessment?.mode, newId: newKey });
      if (result.ok) setRows(result.rows);
      else setFileError(result.error);
    } catch {
      setFileError('این فایل خونده نشد؛ مطمئن شو یک فایل اکسل سالمه');
    } finally {
      setReading(false);
    }
  };

  const apply = () => {
    if (!rows) return;
    const merged = mergeImported(definition, type, rows);
    if ('error' in merged) return setFileError(merged.error);
    onImport(merged.definition, merged.added);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {/* The admin panel is not the 430px product column: the preview table needs room. */}
      <DialogContent className="max-w-[min(calc(100%-2rem),var(--container-3xl))]">
        <DialogHeader>
          <DialogTitle>ورود سؤال‌ها از اکسل</DialogTitle>
          <DialogDescription>
            هر سطر فایل یک سؤاله. سؤال‌ها بعد از سؤال‌های فعلی اضافه می‌شن و قبل از ذخیره می‌تونی ویرایششون کنی.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="question-file">فایل اکسل</Label>
              <Input
                id="question-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={reading}
                onChange={(event) => read(event.target.files?.[0])}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadQuestionTemplate().catch(() => toast.error('فایل نمونه ساخته نشد'))}
            >
              <Download aria-hidden="true" />
              دانلود فایل نمونه
            </Button>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="columns" className="border-b-0">
              <AccordionTrigger className="py-2 text-sm text-muted-foreground">ستون‌های فایل</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {QUESTION_IMPORT_COLUMNS.map((column) => (
                    <div key={column.key} className="flex gap-2">
                      <dt className="shrink-0 font-medium">{column.title}:</dt>
                      <dd className="text-muted-foreground">{column.hint}</dd>
                    </div>
                  ))}
                </dl>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {fileError && (
            <Alert variant="destructive">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          )}

          {rows && (
            <>
              <p className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
                <Badge variant="success">{toPersianDigits(valid.length)} سؤال آماده</Badge>
                {invalid.length > 0 && (
                  <Badge variant="error">{toPersianDigits(invalid.length)} سطر با خطا — اضافه نمی‌شن</Badge>
                )}
              </p>
              <ScrollArea className="max-h-80 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">سطر</TableHead>
                      <TableHead className="w-28">نوع</TableHead>
                      <TableHead>سؤال</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell className="tabular-nums text-muted-foreground">{toPersianDigits(row.row)}</TableCell>
                        <TableCell>{row.question ? QUESTION_KIND_LABELS[row.question.kind] : '—'}</TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="flex items-start gap-2">
                            {row.question ? (
                              <CircleCheck aria-label="درست" className="mt-0.5 size-4 shrink-0 text-success" />
                            ) : (
                              <CircleAlert aria-label="خطا" className="mt-0.5 size-4 shrink-0 text-destructive" />
                            )}
                            <span className="flex flex-col gap-1">
                              <span>{row.title || '—'}</span>
                              {row.errors.map((error) => (
                                <span key={error} className="text-xs text-destructive">
                                  {error}
                                </span>
                              ))}
                            </span>
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}

          {!rows && !fileError && (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              <FileSpreadsheet aria-hidden="true" className="size-8" />
              {reading ? 'در حال خوندن فایل…' : 'فایل نمونه رو پر کن و اینجا انتخابش کن.'}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" onClick={apply} disabled={valid.length === 0}>
            {valid.length > 0 ? `افزودن ${toPersianDigits(valid.length)} سؤال` : 'افزودن سؤال‌ها'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
