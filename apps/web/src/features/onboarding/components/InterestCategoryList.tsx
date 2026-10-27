'use client';

import { useState } from 'react';

import type { InterestCategory } from '@hamdastan/config';
import { Accordion } from '@hamdastan/ui';

import { categorySelection } from '../utils/interest-selection';
import { InterestCategoryCard } from './InterestCategoryCard';

/**
 * The catalog as an accordion of category cards — the picker both stage 1
 * and «ویرایش علاقه‌مندی‌ها» show.
 *
 * Categories start collapsed, and one opens at a time; which one is open is
 * view state only, so the picks survive collapsing and opening another.
 */
export function InterestCategoryList({
  categories,
  selected,
  onCategoryChange,
}: {
  categories: InterestCategory[];
  selected: ReadonlySet<string>;
  onCategoryChange: (category: InterestCategory, values: string[]) => void;
}) {
  const [openCategoryId, setOpenCategoryId] = useState('');

  return (
    <Accordion
      type="single"
      collapsible
      value={openCategoryId}
      onValueChange={setOpenCategoryId}
      className="flex flex-col gap-2"
    >
      {categories.map((category) => (
        <InterestCategoryCard
          key={category.id}
          category={category}
          value={categorySelection(selected, category)}
          onValueChange={(values) => onCategoryChange(category, values)}
          onOpen={() => setOpenCategoryId(category.id)}
          onClear={() => {
            onCategoryChange(category, []);
            if (openCategoryId === category.id) setOpenCategoryId('');
          }}
        />
      ))}
    </Accordion>
  );
}
