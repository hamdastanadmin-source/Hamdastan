'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared';
import {
  answerOf,
  isEmptyAnswer,
  nextPageOverride,
  visibleQuestionIds,
} from '@hamdastan/shared/forms/logic';
import type { AnswerValue, Form, FormAnswer } from '@hamdastan/types';
import { isLayoutQuestion } from '@hamdastan/types';

import { Button } from '../primitives/button';
import { Progress } from '../primitives/progress';
import { QuestionField, resolveAssetUrl } from './QuestionField';

/**
 * A form, as the person answering it experiences it.
 *
 * The same component renders the admin's preview and the page a respondent
 * actually opens, which is what makes "preview shows exactly what end users
 * see" a fact rather than an intention. The difference between the two is one
 * prop: a preview does not submit.
 *
 * It owns the walk through the form — pages, progress, what is visible, what is
 * still missing — and nothing else. The answers go wherever `onSubmit` sends
 * them, and the backend re-checks every rule applied here, because a browser
 * can be told anything.
 */

export type FormRunnerProps = {
  form: Form;
  /** Called with every answer once the last page is submitted. */
  onSubmit?: (answers: FormAnswer[]) => void | Promise<void>;
  /** Called as the respondent moves on, for a draft save. */
  onPageChange?: (answers: FormAnswer[]) => void;
  /** A preview walks the form but never submits it. */
  preview?: boolean;
  /** Shown above the buttons — typically the backend's refusal. */
  error?: string;
  submitting?: boolean;
  /** Skips the welcome screen. The builder's canvas preview starts at page one. */
  skipWelcome?: boolean;
};

type Stage = 'WELCOME' | 'QUESTIONS' | 'DONE';

export function FormRunner({
  form,
  onSubmit,
  onPageChange,
  preview = false,
  error,
  submitting = false,
  skipWelcome = false,
}: FormRunnerProps) {
  const pages = React.useMemo(
    () => [...form.pages].sort((a, b) => a.order - b.order),
    [form.pages]
  );

  const [stage, setStage] = React.useState<Stage>(
    form.settings.welcome.enabled && !skipWelcome ? 'WELCOME' : 'QUESTIONS'
  );
  const [pageIndex, setPageIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<FormAnswer[]>([]);
  const [missing, setMissing] = React.useState<Record<string, string>>({});

  const visible = visibleQuestionIds(form, answers);
  const page = pages[pageIndex];

  const questionsOnPage = form.questions
    .filter((question) => question.pageId === page?.id)
    .filter((question) => visible.has(question.id))
    .sort((a, b) => a.order - b.order);

  const setAnswer = (questionId: string, value: AnswerValue) => {
    setAnswers((current) => {
      const rest = current.filter((answer) => answer.questionId !== questionId);
      return isEmptyAnswer(value) ? rest : [...rest, { questionId, value }];
    });
    setMissing((current) => {
      if (!(questionId in current)) return current;
      const rest = { ...current };
      delete rest[questionId];
      return rest;
    });
  };

  /** Everything required on this page, answered. Checked again by the backend. */
  const pageIsComplete = (): boolean => {
    const unanswered: Record<string, string> = {};

    for (const question of questionsOnPage) {
      if (!question.required || isLayoutQuestion(question.type)) continue;
      if (isEmptyAnswer(answerOf(answers, question.id))) {
        unanswered[question.id] = 'پاسخ به این پرسش الزامی است.';
      }
    }

    setMissing(unanswered);
    return Object.keys(unanswered).length === 0;
  };

  /** Where the respondent goes next — a rule may send them somewhere else. */
  const advance = () => {
    if (!pageIsComplete()) return;

    const jump = nextPageOverride(
      form,
      answers,
      questionsOnPage.map((question) => question.id)
    );

    if (jump === 'END') {
      void finish();
      return;
    }

    if (jump) {
      const target = pages.findIndex((candidate) => candidate.id === jump);
      if (target >= 0) {
        setPageIndex(target);
        onPageChange?.(answers);
        return;
      }
    }

    if (pageIndex === pages.length - 1) {
      void finish();
      return;
    }

    setPageIndex((current) => current + 1);
    onPageChange?.(answers);
  };

  const finish = async () => {
    if (preview) {
      setStage('DONE');
      return;
    }
    await onSubmit?.(answers);
    setStage('DONE');
  };

  const answeredCount = form.questions.filter(
    (question) =>
      !isLayoutQuestion(question.type) &&
      visible.has(question.id) &&
      !isEmptyAnswer(answerOf(answers, question.id))
  ).length;

  const totalCount = form.questions.filter(
    (question) => !isLayoutQuestion(question.type) && visible.has(question.id)
  ).length;

  // ─── Welcome ──────────────────────────────────────────────────────────────

  if (stage === 'WELCOME') {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{form.settings.welcome.title}</h1>
          {form.settings.welcome.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {form.settings.welcome.description}
            </p>
          )}
        </div>

        {form.settings.welcome.imageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element -- the design
             system is framework-agnostic and cannot import next/image. */
          <img
            src={resolveAssetUrl(form.settings.welcome.imageUrl)}
            alt=""
            className="mx-auto max-h-56 rounded-lg object-cover"
          />
        )}

        <Button size="lg" onClick={() => setStage('QUESTIONS')}>
          {form.settings.welcome.buttonLabel}
        </Button>
      </div>
    );
  }

  // ─── Thank you ────────────────────────────────────────────────────────────

  if (stage === 'DONE') {
    return (
      <div className="space-y-4 py-8 text-center">
        <CircleCheck className="mx-auto size-12 text-success" />
        <h2 className="text-xl font-bold">{form.settings.thankYou.title}</h2>
        {form.settings.thankYou.description && (
          <p className="text-sm text-muted-foreground">{form.settings.thankYou.description}</p>
        )}
        {form.settings.thankYou.buttonLabel && form.settings.thankYou.buttonUrl && (
          <Button asChild variant="outline">
            <a href={form.settings.thankYou.buttonUrl}>{form.settings.thankYou.buttonLabel}</a>
          </Button>
        )}
        {preview && (
          <p className="text-xs text-muted-foreground">
            (پیش‌نمایش — پاسخی ثبت نشد)
          </p>
        )}
      </div>
    );
  }

  // ─── The questions ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {form.settings.showProgress && pages.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              صفحهٔ {toPersianDigits(pageIndex + 1)} از {toPersianDigits(pages.length)}
            </span>
            <span>
              {toPersianDigits(answeredCount)} از {toPersianDigits(totalCount)} پرسش
            </span>
          </div>
          <Progress value={totalCount === 0 ? 0 : (answeredCount / totalCount) * 100} />
        </div>
      )}

      {page && (page.title || page.description) && (
        <div className="space-y-1">
          <h2 className="text-lg font-bold">{page.title}</h2>
          {page.description && (
            <p className="text-sm text-muted-foreground">{page.description}</p>
          )}
        </div>
      )}

      <div className="space-y-6">
        {questionsOnPage.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            این صفحه هنوز پرسشی ندارد.
          </p>
        )}

        {questionsOnPage.map((question, position) => (
          <QuestionField
            key={question.id}
            question={question}
            value={answerOf(answers, question.id)}
            onChange={(value) => setAnswer(question.id, value)}
            error={missing[question.id]}
            {...(isLayoutQuestion(question.type) ? {} : { index: position + 1 })}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-error/40 bg-error/10 p-3 text-sm text-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
        >
          {/* rtl-ok: in RTL, "previous" points to the right. */}
          <ChevronRight className="size-4" />
          قبلی
        </Button>

        <Button type="button" onClick={advance} loading={submitting}>
          {pageIndex === pages.length - 1 ? 'ثبت پاسخ' : 'بعدی'}
          {pageIndex < pages.length - 1 && (
            // rtl-ok: in RTL, "next" points to the left.
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
