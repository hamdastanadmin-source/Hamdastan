'use client';

import { Pencil } from 'lucide-react';

import { formatPhone } from '@hamdastan/shared';
import { Button } from '@hamdastan/ui';

/**
 * The number a code was sent to, with the way back to change it.
 *
 * Shown on both steps that come after the number is entered, so the user can
 * always see which number they are waiting on and correct a typo without
 * starting over.
 */
export function PhoneSummary({
  phone,
  onEdit,
  disabled,
}: {
  phone: string;
  onEdit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      {/* rtl-ok: a phone number reads left-to-right in every locale. */}
      <span dir="ltr" className="text-sm font-medium text-foreground">
        {formatPhone(phone)}
      </span>
      <Button type="button" variant="ghost" size="sm" onClick={onEdit} disabled={disabled}>
        <Pencil className="size-3.5" />
        ویرایش شماره
      </Button>
    </div>
  );
}
