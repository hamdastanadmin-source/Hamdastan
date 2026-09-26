'use client';

import { useState } from 'react';
import { Copy, Flag, GripVertical, PartyPopper, Trash2 } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared';
import type { FormPage, FormQuestion, QuestionType } from '@hamdastan/types';
import { isLayoutQuestion } from '@hamdastan/types';
import { Badge, Button, Input, QuestionField } from '@hamdastan/ui';

import type { FormBuilder } from '../../hooks/use-form-builder';
import { paletteItem } from '../../types/question-catalogue';
import { DRAG_NEW_QUESTION } from './QuestionPalette';

/**
 * The form as its author sees it being built.
 *
 * Each question renders as the control that will answer it — the same
 * `QuestionField` the respondent gets, disabled — so the canvas is the form
 * rather than a diagram of it.
 *
 * Drag and drop is the browser's own: the palette carries a type, a card
 * carries its id, and the drop zones between cards say where either lands. No
 * drag library, because HTML5 drag events already do this and a dependency for
 * it would have to be maintained.
 */

/** What dragging an existing card carries. */
const DRAG_EXISTING_QUESTION = 'application/x-hamdastan-question-id';

type DropTarget = { pageId: string; position: number } | null;

export function FormCanvas({ builder }: { builder: FormBuilder }) {
  const { form } = builder;
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);

  const pages = [...form.pages].sort((a, b) => a.order - b.order);

  /** Accepts both kinds of drag: a new question, or one being moved. */
  const handleDrop = (event: React.DragEvent, pageId: string, position: number) => {
    event.preventDefault();
    setDropTarget(null);

    const type = event.dataTransfer.getData(DRAG_NEW_QUESTION) as QuestionType | '';
    if (type) {
      builder.addQuestion(type, pageId, position);
      return;
    }

    const id = event.dataTransfer.getData(DRAG_EXISTING_QUESTION);
    if (id) builder.moveQuestion(id, pageId, position);
  };

  const dropZone = (pageId: string, position: number) => {
    const active = dropTarget?.pageId === pageId && dropTarget.position === position;

    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setDropTarget({ pageId, position });
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(event) => handleDrop(event, pageId, position)}
        className={`rounded-md transition-all ${
          active
            ? 'my-2 h-12 border-2 border-dashed border-primary bg-primary/5'
            : 'h-2'
        }`}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      {form.settings.welcome.enabled && (
        <section className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-center">
          <Badge variant="secondary" className="mb-2">
            <Flag className="size-3 me-1" />
            صفحهٔ خوش‌آمد
          </Badge>
          <h2 className="text-lg font-bold">{form.settings.welcome.title}</h2>
          {form.settings.welcome.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {form.settings.welcome.description}
            </p>
          )}
          <Button size="sm" variant="outline" className="mt-3" disabled>
            {form.settings.welcome.buttonLabel}
          </Button>
        </section>
      )}

      {pages.map((page, pageIndex) => (
        <PageSection
          key={page.id}
          page={page}
          index={pageIndex}
          pageCount={pages.length}
          builder={builder}
          dropZone={dropZone}
          onDragStartCard={(event, question) => {
            event.dataTransfer.setData(DRAG_EXISTING_QUESTION, question.id);
            event.dataTransfer.effectAllowed = 'move';
          }}
        />
      ))}

      <section className="rounded-xl border border-dashed border-border bg-card/60 p-5 text-center">
        <Badge variant="secondary" className="mb-2">
          <PartyPopper className="size-3 me-1" />
          صفحهٔ پایان
        </Badge>
        <h2 className="text-lg font-bold">{form.settings.thankYou.title}</h2>
        {form.settings.thankYou.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {form.settings.thankYou.description}
          </p>
        )}
      </section>
    </div>
  );
}

function PageSection({
  page,
  index,
  pageCount,
  builder,
  dropZone,
  onDragStartCard,
}: {
  page: FormPage;
  index: number;
  pageCount: number;
  builder: FormBuilder;
  dropZone: (pageId: string, position: number) => React.ReactNode;
  onDragStartCard: (event: React.DragEvent, question: FormQuestion) => void;
}) {
  const questions = builder.form.questions
    .filter((question) => question.pageId === page.id)
    .sort((a, b) => a.order - b.order);

  /**
   * The number a respondent will see beside each question.
   *
   * Computed up front rather than counted while rendering: layout blocks are
   * not numbered, so the index is not the position, and a counter mutated
   * during render is exactly what React tells you not to write.
   */
  const numbering = new Map<string, number>();
  questions.reduce((count, question) => {
    if (isLayoutQuestion(question.type)) return count;
    numbering.set(question.id, count + 1);
    return count + 1;
  }, 0);

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <header className="mb-2 flex items-center gap-2">
        <Badge variant="outline" className="shrink-0">
          صفحهٔ {toPersianDigits(index + 1)}
        </Badge>
        <Input
          value={page.title}
          onChange={(event) => builder.updatePage(page.id, { title: event.target.value })}
          className="h-8 border-transparent bg-transparent px-2 text-sm font-medium hover:border-border focus-visible:border-input"
          aria-label={`عنوان صفحهٔ ${index + 1}`}
        />
        {pageCount > 1 && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="حذف صفحه"
            onClick={() => builder.removePage(page.id)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}
      </header>

      {dropZone(page.id, 0)}

      {questions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          یک پرسش را از پنل کناری به اینجا بکشید
        </div>
      )}

      {questions.map((question, position) => {
        const index = numbering.get(question.id);

        return (
          <div key={question.id}>
            <QuestionCard
              question={question}
              index={index}
              selected={builder.selectedId === question.id}
              onSelect={() => builder.select(question.id)}
              onDuplicate={() => builder.duplicateQuestion(question.id)}
              onRemove={() => builder.removeQuestion(question.id)}
              onDragStart={(event) => onDragStartCard(event, question)}
            />
            {dropZone(page.id, position + 1)}
          </div>
        );
      })}
    </section>
  );
}

function QuestionCard({
  question,
  index,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  onDragStart,
}: {
  question: FormQuestion;
  index?: number;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: (event: React.DragEvent) => void;
}) {
  const item = paletteItem(question.type);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group relative rounded-lg border bg-background p-4 text-start transition-colors ${
        selected ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40'
      }`}
    >
      {/* The hover controls sit above the card, so they never cover an answer. */}
      <div className="absolute -top-3 end-3 flex items-center gap-1 rounded-md border border-border bg-card p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <span
          className="flex size-6 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          aria-hidden
        >
          <GripVertical className="size-3.5" />
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="رونوشت پرسش"
          onClick={(event) => {
            event.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="حذف پرسش"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <item.icon className="size-3.5 text-muted-foreground" />
        <span className="text-2xs text-muted-foreground">{item.label}</span>
        {question.required && (
          <Badge variant="outline" className="h-4 px-1 text-2xs">
            الزامی
          </Badge>
        )}
      </div>

      {/* Disabled: the canvas shows the control, it does not collect answers. */}
      <QuestionField
        question={question}
        value={null}
        onChange={() => undefined}
        disabled
        {...(index === undefined ? {} : { index })}
      />
    </div>
  );
}
