'use client';

import { useState } from 'react';

import { answerOf, answerText, formatJalaliDate, toPersianDigits } from '@hamdastan/shared';
import type { Form, FormResponse } from '@hamdastan/types';
import { isLayoutQuestion } from '@hamdastan/types';
import {
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@hamdastan/ui';

/**
 * The responses one at a time.
 *
 * The table answers "who, when, how long"; clicking a row opens what they
 * actually wrote, question by question in the form's own order — including the
 * ones they skipped, because a blank is part of the answer.
 */
export function IndividualResponses({
  form,
  responses,
}: {
  form: Form;
  responses: FormResponse[];
}) {
  const [open, setOpen] = useState<FormResponse | null>(null);

  const questions = form.questions
    .filter((question) => !isLayoutQuestion(question.type))
    .sort((a, b) => a.order - b.order);

  if (responses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        هنوز کسی به این فرم پاسخ نداده است.
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>پاسخ‌دهنده</TableHead>
            <TableHead>تاریخ ثبت</TableHead>
            <TableHead>وضعیت</TableHead>
            <TableHead>مدت پاسخ‌گویی</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {responses.map((response) => (
            <TableRow
              key={response.id}
              className="cursor-pointer"
              onClick={() => setOpen(response)}
            >
              <TableCell className="font-medium">
                {response.respondentName ?? 'ناشناس'}
              </TableCell>
              <TableCell className="text-xs">
                {formatJalaliDate(response.submittedAt ?? response.startedAt)}
              </TableCell>
              <TableCell>
                {response.status === 'COMPLETE' ? (
                  <Badge variant="success">کامل</Badge>
                ) : (
                  <Badge variant="warning">ناقص</Badge>
                )}
              </TableCell>
              <TableCell className="text-xs">
                {response.completionSeconds === null
                  ? '—'
                  : `${toPersianDigits(response.completionSeconds)} ثانیه`}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>پاسخ {open?.respondentName ?? 'ناشناس'}</DialogTitle>
            <DialogDescription>
              {open && formatJalaliDate(open.submittedAt ?? open.startedAt)}
              {open?.completionSeconds !== null &&
                open?.completionSeconds !== undefined &&
                ` — ${toPersianDigits(open.completionSeconds)} ثانیه`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {open &&
              questions.map((question, index) => {
                const value = answerOf(open.answers, question.id);
                const text = answerText(value);

                return (
                  <div key={question.id} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {toPersianDigits(index + 1)}. {question.title || 'بدون عنوان'}
                    </p>
                    <p className={`mt-1 text-sm ${text ? '' : 'text-muted-foreground'}`}>
                      {text || 'بدون پاسخ'}
                    </p>
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
