import type { ReactNode } from 'react';

/**
 * A labelled group of controls.
 *
 * `FormField` in `@hamdastan/ui` attaches its label to a single child, so it
 * cannot describe a set of radios or three dropdowns that mean one value. This
 * is the group equivalent: a real `fieldset`/`legend`, which is what a screen
 * reader needs to read the controls as one question.
 */
export function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-error ms-0.5">*</span>}
      </legend>

      {children}

      {error && (
        <p className="text-sm text-error" aria-live="polite">
          {error}
        </p>
      )}
    </fieldset>
  );
}
