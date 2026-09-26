'use client';

import { MessageSquareText } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared';
import type { ChoiceBreakdown, QuestionStats } from '@hamdastan/types';
import { Badge, Card, CardContent, CardHeader, CardTitle, ScrollArea } from '@hamdastan/ui';

import { paletteItem } from '../../types/question-catalogue';

/**
 * Each question's answers, drawn the way that question deserves.
 *
 * Choice questions get proportions, scales get an average with a distribution,
 * NPS gets its score and its three groups, and free text gets the answers
 * themselves — a bar chart of sentences would say nothing.
 *
 * The bars are CSS widths rather than a charting library. The project has not
 * chosen one (see `packages/ui/components/index.tsx`), and a proportion bar is
 * a div at a percentage width: adding a dependency for that would be a
 * decision made by accident.
 */

export function QuestionAnalysis({ questions }: { questions: QuestionStats[] }) {
  if (questions.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        این فرم پرسشی برای تحلیل ندارد.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const item = paletteItem(question.type);

        return (
          <Card key={question.questionId}>
            <CardHeader className="gap-1">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-sm leading-relaxed">
                  {toPersianDigits(index + 1)}. {question.title || 'بدون عنوان'}
                </CardTitle>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <item.icon className="size-3" />
                  {item.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {toPersianDigits(question.answerCount)} پاسخ
                {question.skippedCount > 0 &&
                  ` — ${toPersianDigits(question.skippedCount)} بی‌پاسخ`}
              </p>
            </CardHeader>

            <CardContent className="space-y-3">
              {(question.average !== undefined || question.npsScore !== undefined) && (
                <div className="flex flex-wrap gap-3">
                  {question.average !== undefined && (
                    <Metric label="میانگین" value={toPersianDigits(question.average)} />
                  )}
                  {question.npsScore !== undefined && (
                    <Metric
                      label="شاخص NPS"
                      value={toPersianDigits(question.npsScore)}
                      tone={
                        question.npsScore >= 50
                          ? 'text-success'
                          : question.npsScore >= 0
                            ? 'text-warning'
                            : 'text-error'
                      }
                    />
                  )}
                </div>
              )}

              {question.breakdown && question.breakdown.length > 0 && (
                <BreakdownChart rows={question.breakdown} />
              )}

              {question.textAnswers && (
                <TextAnswers answers={question.textAnswers} />
              )}

              {!question.breakdown && !question.textAnswers && question.answerCount === 0 && (
                <p className="text-sm text-muted-foreground">هنوز پاسخی ثبت نشده است.</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function BreakdownChart({ rows }: { rows: ChoiceBreakdown[] }) {
  const widest = Math.max(...rows.map((row) => row.percentage), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="truncate">{row.label}</span>
            <span className="shrink-0 text-muted-foreground">
              {toPersianDigits(row.count)} — {toPersianDigits(row.percentage)}٪
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              // The width is data, not a design value — it cannot be a class.
              style={{ width: `${(row.percentage / widest) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TextAnswers({ answers }: { answers: string[] }) {
  if (answers.length === 0) {
    return <p className="text-sm text-muted-foreground">هنوز پاسخی ثبت نشده است.</p>;
  }

  return (
    <ScrollArea className="max-h-64">
      <div className="space-y-2 pe-2">
        {answers.map((answer, index) => (
          <div
            key={index}
            className="flex gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-sm"
          >
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <p className="leading-relaxed">{answer}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
