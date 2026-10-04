import { X } from 'lucide-react';

import type { InterestCategory } from '@hamdastan/config';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  ToggleGroup,
} from '@hamdastan/ui';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { InterestChip } from './InterestChip';

/**
 * One category, as a standalone card in an accordion. The header runs, in
 * reading order, checkbox → title → «n انتخاب» → X → chevron, so in RTL the
 * checkbox sits at the start edge and the chevron at the end. Opening grows
 * the same card and shows the interests as chips; collapsing keeps the picks.
 *
 * "Selected" is not a state of its own: a category is selected when one of
 * its interests is, which is also what the three-category rule counts. So
 * the checkbox mirrors that — ticking an empty one opens the card to pick
 * from, unticking clears it. The checkbox and the X sit beside the trigger
 * rather than inside it, because a button cannot hold a button; the X is
 * laid over the trigger's end, just before its chevron.
 */
export function InterestCategoryCard({
  category,
  value,
  onValueChange,
  onOpen,
  onClear,
}: {
  category: InterestCategory;
  value: string[];
  onValueChange: (value: string[]) => void;
  onOpen: () => void;
  onClear: () => void;
}) {
  const isSelected = value.length > 0;

  return (
    <AccordionItem
      value={category.id}
      className={cn(
        'rounded-2xl border bg-card px-5 py-6 transition-colors last:border-b',
        isSelected ? 'border-primary' : 'border-border'
      )}
    >
      <div className="relative flex items-center gap-3 [&>h3]:flex-1">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => (checked ? onOpen() : onClear())}
          aria-label={category.title}
          className="size-6 rounded-md [&_svg]:size-4"
        />
        <AccordionTrigger className="items-center gap-3 rounded-md py-0 hover:no-underline [&>svg]:size-5 [&>svg]:translate-y-0">
          <span className="flex flex-1 items-center gap-3">
            <span className="text-lg font-bold text-foreground">{category.title}</span>
            {isSelected && (
              <span className="ms-auto me-14 text-xs text-muted-foreground">
                {toPersianDigits(value.length)} انتخاب
              </span>
            )}
          </span>
        </AccordionTrigger>
        {isSelected && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            aria-label={`پاک کردن انتخاب‌های ${category.title}`}
            className="absolute end-8 top-1/2 size-11 -translate-y-1/2 text-muted-foreground"
          >
            <X />
          </Button>
        )}
      </div>

      <AccordionContent className="pt-5 pb-0">
        <ToggleGroup
          type="multiple"
          spacing={2}
          value={value}
          onValueChange={onValueChange}
          aria-label={category.title}
          className="w-full flex-wrap justify-start"
        >
          {category.interests.map((interest) => (
            <InterestChip key={interest.id} value={interest.id} label={interest.label} />
          ))}
        </ToggleGroup>
      </AccordionContent>
    </AccordionItem>
  );
}
