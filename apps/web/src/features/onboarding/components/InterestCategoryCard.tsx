import type { InterestCategory } from '@hamdastan/config';
import { Card, CardContent, CardHeader, CardTitle, ToggleGroup } from '@hamdastan/ui';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { InterestChip } from './InterestChip';

/**
 * One category: a card, its title, and its interests as a wrapping row of
 * chips. The category is one multi-select `ToggleGroup`, named by its title,
 * so a screen reader hears «موسیقی و اجرا، گروه» before the first chip.
 */
export function InterestCategoryCard({
  category,
  value,
  onValueChange,
}: {
  category: InterestCategory;
  value: string[];
  onValueChange: (value: string[]) => void;
}) {
  const titleId = `interest-category-${category.id}`;

  return (
    <Card className="shadow-none">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4 pb-3">
        <CardTitle id={titleId} role="heading" aria-level={2} className="text-base font-bold">
          {category.title}
        </CardTitle>
        {value.length > 0 && (
          <span className="text-xs font-medium text-primary">
            {toPersianDigits(value.length)} انتخاب
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ToggleGroup
          type="multiple"
          spacing={2}
          value={value}
          onValueChange={onValueChange}
          aria-labelledby={titleId}
          className="w-full flex-wrap justify-start"
        >
          {category.interests.map((interest) => (
            <InterestChip key={interest.id} value={interest.id} label={interest.label} />
          ))}
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}
