'use client';

import { useState } from 'react';

import { cn } from '@hamdastan/shared/cn';
import { Button } from '@hamdastan/ui';

import { RichText } from './RichText';

/** Longer than this, the description opens folded. */
const FOLD_AT = 600;

/** The description, folded behind «ادامه‌ی توضیحات» when it is long. */
export function EventDescription({ source }: { source: string }) {
  const long = source.length > FOLD_AT;
  const [open, setOpen] = useState(!long);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'relative',
          !open && 'max-h-48 overflow-hidden after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-linear-to-t after:from-background after:to-transparent'
        )}
      >
        <RichText source={source} />
      </div>
      {long && (
        <Button variant="link" size="sm" className="h-auto w-fit p-0" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'بستن توضیحات' : 'ادامه‌ی توضیحات'}
        </Button>
      )}
    </div>
  );
}
