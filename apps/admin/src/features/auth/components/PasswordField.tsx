'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';
import { Button, FormField, Input } from '@hamdastan/ui';

/**
 * A password box with a reveal toggle.
 *
 * Shared by all three password fields in the panel — both on the
 * change-password form and the one on the login form. `autoComplete` is the
 * only thing that differs between them, and it matters: a browser must not
 * offer to fill a new password with the current one.
 *
 * In an error state there are two things at the inline end: `Input` draws its
 * own alert icon there, and the reveal toggle lives there too. They each get
 * their own space rather than stacking — the toggle steps inward and the
 * padding grows to match, so neither is ever drawn on top of the other.
 */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  error,
  autoFocus,
  autoComplete = 'new-password',
  enterKeyHint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
  autoComplete?: 'new-password' | 'current-password';
  enterKeyHint?: 'go' | 'next';
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <FormField label={label} required error={error}>
      <div className="relative">
        <Input
          name={name}
          type={revealed ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          enterKeyHint={enterKeyHint}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          state={error ? 'error' : undefined}
          // rtl-ok: a password is typed in Latin characters.
          dir="ltr"
          className={cn('text-start', error ? 'pe-20' : 'pe-11')}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            // Clears the alert icon `Input` puts at `end-3`.
            error ? 'end-9' : 'end-1.5'
          )}
          onClick={() => setRevealed((current) => !current)}
          aria-label={revealed ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </FormField>
  );
}
