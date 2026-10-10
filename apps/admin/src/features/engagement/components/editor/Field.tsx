import type { ReactNode } from 'react';

import { cn } from '@hamdastan/shared/cn';
import { Label } from '@hamdastan/ui';

/**
 * A label, its control, a line of help and the error under it — the
 * builder's one field layout. The control itself carries `aria-invalid`
 * (see `invalid`), which the stock shadcn controls already style.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Props that mark a control invalid when its path has an error. */
export const invalid = (error: string | undefined) => (error ? { 'aria-invalid': true as const } : {});

/**
 * A checked checkbox in foreground, not brand: the brand colour is the
 * screen's primary action only.
 */
export const NEUTRAL_CHECKBOX =
  'data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background dark:data-[state=checked]:bg-foreground';

/** Switches between a row's label and its control. */
export function SwitchRow({ id, label, hint, children }: { id: string; label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
