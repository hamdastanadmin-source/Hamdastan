'use client';

import { GitBranch, Plus, Trash2 } from 'lucide-react';

import type { LogicAction, LogicOperator, LogicRule } from '@hamdastan/types';
import { isLayoutQuestion } from '@hamdastan/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hamdastan/ui';

import type { FormBuilder } from '../../hooks/use-form-builder';
import { newId } from '../../types/question-catalogue';

/**
 * Conditional logic, as rules you can read aloud.
 *
 * Each rule is one sentence — *اگر پاسخ پرسش ۲ برابر «بله» بود، پرسش ۵ را نشان
 * بده* — built from four dropdowns. A visual rule builder rather than an
 * expression language, because the person writing these is an author, not a
 * programmer.
 *
 * The rules are stored on the form and evaluated by
 * `@hamdastan/shared/forms/logic`, which the respondent's screen, the preview
 * and the backend all share. Nothing here evaluates anything.
 */

const OPERATORS: Record<LogicOperator, string> = {
  EQUALS: 'برابر باشد با',
  NOT_EQUALS: 'برابر نباشد با',
  CONTAINS: 'شامل باشد',
  GREATER_THAN: 'بزرگ‌تر باشد از',
  LESS_THAN: 'کوچک‌تر باشد از',
  IS_ANSWERED: 'پاسخ داده شده باشد',
  IS_EMPTY: 'بدون پاسخ باشد',
};

const ACTIONS: Record<LogicAction, string> = {
  SHOW: 'نمایش بده',
  HIDE: 'پنهان کن',
  JUMP_TO_PAGE: 'برو به صفحهٔ',
  END_FORM: 'فرم را پایان بده',
};

/** These two compare nothing, so the value box is hidden for them. */
const VALUELESS = new Set<LogicOperator>(['IS_ANSWERED', 'IS_EMPTY']);

export function LogicPanel({ builder }: { builder: FormBuilder }) {
  const { form } = builder;
  const questions = form.questions.filter((question) => !isLayoutQuestion(question.type));
  const rules = form.conditionalLogic;

  const label = (id: string) => {
    const index = questions.findIndex((question) => question.id === id);
    const question = questions[index];
    if (!question) return 'پرسش حذف‌شده';
    return `${index + 1}. ${question.title || 'بدون عنوان'}`;
  };

  const update = (id: string, patch: Partial<LogicRule>) =>
    builder.setLogic(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  const add = () => {
    if (questions.length < 1) return;

    builder.setLogic([
      ...rules,
      {
        id: newId(),
        whenQuestionId: questions[0].id,
        operator: 'EQUALS',
        value: '',
        action: 'SHOW',
        targetQuestionId: questions[questions.length - 1].id,
      },
    ]);
  };

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <GitBranch className="size-4 text-primary" />
              منطق شرطی
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              بر اساس پاسخ‌ها تصمیم بگیرید کدام پرسش دیده شود، کجا پرش انجام شود یا فرم کِی
              تمام شود.
            </p>
          </div>

          <Button size="sm" onClick={add} disabled={questions.length === 0}>
            <Plus className="size-4" />
            قانون جدید
          </Button>
        </div>

        {questions.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            ابتدا چند پرسش بسازید تا بتوانید برایشان قانون بنویسید.
          </p>
        )}

        {questions.length > 0 && rules.length === 0 && (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
            هنوز قانونی تعریف نشده است. همهٔ پرسش‌ها به همه نمایش داده می‌شوند.
          </p>
        )}

        {rules.map((rule, index) => (
          <Card key={rule.id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">قانون {index + 1}</Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="حذف قانون"
                  onClick={() => builder.setLogic(rules.filter((entry) => entry.id !== rule.id))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                <Badge variant="outline" className="w-fit">
                  اگر
                </Badge>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    value={rule.whenQuestionId}
                    onValueChange={(value) => update(rule.id, { whenQuestionId: value })}
                  >
                    <SelectTrigger aria-label="پرسش شرط">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {questions.map((question, position) => (
                        <SelectItem key={question.id} value={question.id}>
                          {position + 1}. {question.title || 'بدون عنوان'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={rule.operator}
                    onValueChange={(value) =>
                      update(rule.id, { operator: value as LogicOperator })
                    }
                  >
                    <SelectTrigger aria-label="شرط">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATORS).map(([value, text]) => (
                        <SelectItem key={value} value={value}>
                          {text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!VALUELESS.has(rule.operator) && (
                    <Input
                      value={rule.value ?? ''}
                      onChange={(event) => update(rule.id, { value: event.target.value })}
                      placeholder="مقدار، مثلاً: بله"
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-[auto_1fr] sm:items-center">
                <Badge variant="outline" className="w-fit">
                  آنگاه
                </Badge>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Select
                    value={rule.action}
                    onValueChange={(value) => update(rule.id, { action: value as LogicAction })}
                  >
                    <SelectTrigger aria-label="اقدام">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ACTIONS).map(([value, text]) => (
                        <SelectItem key={value} value={value}>
                          {text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(rule.action === 'SHOW' || rule.action === 'HIDE') && (
                    <Select
                      value={rule.targetQuestionId}
                      onValueChange={(value) => update(rule.id, { targetQuestionId: value })}
                    >
                      <SelectTrigger aria-label="پرسش هدف">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {questions.map((question, position) => (
                          <SelectItem key={question.id} value={question.id}>
                            {position + 1}. {question.title || 'بدون عنوان'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {rule.action === 'JUMP_TO_PAGE' && (
                    <Select
                      value={rule.targetPageId}
                      onValueChange={(value) => update(rule.id, { targetPageId: value })}
                    >
                      <SelectTrigger aria-label="صفحهٔ مقصد">
                        <SelectValue placeholder="انتخاب صفحه" />
                      </SelectTrigger>
                      <SelectContent>
                        {form.pages.map((page, position) => (
                          <SelectItem key={page.id} value={page.id}>
                            {position + 1}. {page.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                اگر «{label(rule.whenQuestionId)}» {OPERATORS[rule.operator]}
                {!VALUELESS.has(rule.operator) && ` «${rule.value || '…'}»`}، آنگاه{' '}
                {rule.action === 'SHOW' || rule.action === 'HIDE'
                  ? `«${label(rule.targetQuestionId ?? '')}» را ${ACTIONS[rule.action]}`
                  : ACTIONS[rule.action]}
                .
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
