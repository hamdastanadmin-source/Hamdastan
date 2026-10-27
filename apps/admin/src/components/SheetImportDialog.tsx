'use client';

import { useState } from 'react';
import { CircleAlert, CircleCheck, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
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
import type { SheetCell, SheetColumn } from '@hamdastan/validation';

import { errorMessage, MAX_IMPORT_BYTES, readSheet } from '@/lib';

/** One row as the preview shows it. A row with errors is left out. */
export type SheetPreviewRow = {
  /** 1-based, as the spreadsheet numbers it. */
  row: number;
  /** The short first column — a question's kind, an interest's category. */
  tag?: string;
  /** What the row is, as written. */
  label: string;
  errors: string[];
};

type ParseResult<Row> = { ok: true; rows: Row[] } | { ok: false; error: string };

/**
 * «ورود از اکسل», for every import in the panel: download the template,
 * choose a file, see every row — what it becomes, or what is wrong with it,
 * by row number — then add the valid ones. Rows with errors are listed and
 * left out; nothing is dropped silently. The file is read here, in the
 * browser; `onApply` decides what happens to the rows.
 */
export function SheetImportDialog<Row extends SheetPreviewRow>({
  open,
  onOpenChange,
  title,
  description,
  noun,
  heads,
  columns,
  onDownloadTemplate,
  parse,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** What one row is, for the counts and the button: «سؤال», «علاقه‌مندی». */
  noun: string;
  /** The preview table's two column titles. */
  heads: { tag: string; label: string };
  columns: readonly SheetColumn<string>[];
  onDownloadTemplate: () => Promise<void>;
  parse: (sheet: SheetCell[][]) => ParseResult<Row>;
  /** Adds the valid rows. Throws, or answers with a message, to keep the dialog open with it. */
  onApply: (rows: Row[]) => Promise<string | void> | string | void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);

  const valid = rows?.filter((row) => row.errors.length === 0) ?? [];
  const invalid = rows?.filter((row) => row.errors.length > 0) ?? [];

  const reset = () => {
    setRows(null);
    setFileError(null);
  };

  const read = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) return setFileError('فقط فایل اکسل ‎.xlsx‎ پذیرفته می‌شود');
    if (file.size > MAX_IMPORT_BYTES) return setFileError('حجم فایل بیشتر از ۲ مگابایت است');
    setReading(true);
    try {
      const result = parse(await readSheet(file));
      if (result.ok) setRows(result.rows);
      else setFileError(result.error);
    } catch {
      setFileError('این فایل خوانده نشد؛ از سالم بودن فایل اکسل اطمینان حاصل کنید');
    } finally {
      setReading(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const error = await onApply(valid);
      if (error) return setFileError(error);
      reset();
      onOpenChange(false);
    } catch (caught) {
      setFileError(errorMessage(caught));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (applying) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      {/* The admin panel is not the 430px product column: the preview table needs room. */}
      <DialogContent className="max-w-[min(calc(100%-2rem),var(--container-3xl))]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Label htmlFor="sheet-file">فایل اکسل</Label>
              <Input
                id="sheet-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={reading || applying}
                onChange={(event) => read(event.target.files?.[0])}
              />
            </div>
            <Button type="button" variant="outline" onClick={() => onDownloadTemplate().catch(() => toast.error('فایل نمونه ساخته نشد'))}>
              <Download aria-hidden="true" />
              دانلود فایل نمونه
            </Button>
          </div>

          <Accordion type="single" collapsible>
            <AccordionItem value="columns" className="border-b-0">
              <AccordionTrigger className="py-2 text-sm text-muted-foreground">ستون‌های فایل</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {/* A numbered run of columns (گزینه ۱، ۲، …) is explained once, on its first. */}
                  {columns.filter((column) => column.hint).map((column) => (
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
                <Badge variant="success">
                  {toPersianDigits(valid.length)} {noun} آماده
                </Badge>
                {invalid.length > 0 && (
                  <Badge variant="error">{toPersianDigits(invalid.length)} سطر دارای خطا — اضافه نمی‌شوند</Badge>
                )}
              </p>
              <ScrollArea className="max-h-80 rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">سطر</TableHead>
                      <TableHead className="w-36">{heads.tag}</TableHead>
                      <TableHead>{heads.label}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.row}>
                        <TableCell className="tabular-nums text-muted-foreground">{toPersianDigits(row.row)}</TableCell>
                        <TableCell className="whitespace-normal">{row.tag || '—'}</TableCell>
                        <TableCell className="whitespace-normal">
                          <span className="flex items-start gap-2">
                            {row.errors.length === 0 ? (
                              <CircleCheck aria-label="درست" className="mt-0.5 size-4 shrink-0 text-success" />
                            ) : (
                              <CircleAlert aria-label="خطا" className="mt-0.5 size-4 shrink-0 text-destructive" />
                            )}
                            <span className="flex flex-col gap-1">
                              <span>{row.label || '—'}</span>
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
              {reading ? 'در حال خواندن فایل…' : 'فایل نمونه را تکمیل و در این قسمت انتخاب کنید.'}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={applying}>
              انصراف
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => void apply()} disabled={valid.length === 0} loading={applying}>
            {valid.length > 0 ? `افزودن ${toPersianDigits(valid.length)} ${noun}` : `افزودن ${noun}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
