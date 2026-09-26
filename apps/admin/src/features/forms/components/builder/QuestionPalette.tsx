'use client';

import { PanelRightClose, Plus } from 'lucide-react';

import type { QuestionType } from '@hamdastan/types';
import { Button, ScrollArea, Separator } from '@hamdastan/ui';

import {
  PageBreakIcon,
  QUESTION_GROUPS,
} from '../../types/question-catalogue';

/**
 * The component library, on the right — where a hand reaches first in an RTL
 * layout.
 *
 * Every item is draggable onto the canvas and clickable as a shortcut for
 * "append to the current page", because dragging is the discoverable gesture
 * but clicking is the fast one.
 *
 * Dragging carries the question *type*; the canvas decides where it lands. The
 * two halves agree through `DRAG_TYPE` and nothing else.
 */

/** What a palette drag carries. The canvas listens for exactly this. */
export const DRAG_NEW_QUESTION = 'application/x-hamdastan-question-type';

export function QuestionPalette({
  onAdd,
  onAddPage,
  onCollapse,
}: {
  onAdd: (type: QuestionType) => void;
  onAddPage: () => void;
  onCollapse: () => void;
}) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-s border-border bg-card/40">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold">افزودن پرسش</span>
        <Button variant="ghost" size="icon-sm" aria-label="بستن پنل" onClick={onCollapse}>
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {QUESTION_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <p className="px-1 text-xs font-medium text-muted-foreground">{group.title}</p>

              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_NEW_QUESTION, item.type);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onAdd(item.type)}
                    className="flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-border bg-card p-2.5 text-center transition-colors hover:border-primary/40 hover:bg-muted/60 active:cursor-grabbing"
                  >
                    <item.icon className="size-4 text-muted-foreground" />
                    <span className="text-2xs leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <Separator />

          <Button variant="outline" size="sm" className="w-full" onClick={onAddPage}>
            <PageBreakIcon className="size-4" />
            صفحهٔ جدید
            <Plus className="size-3.5" />
          </Button>
        </div>
      </ScrollArea>
    </aside>
  );
}
