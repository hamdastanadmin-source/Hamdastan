'use client';

import { useState } from 'react';

import { Button, FormField, Input } from '@hamdastan/ui';

import type { AuthFlowError } from '../types/auth.types';
import { sanitizePhoneInput } from '../utils/auth.utils';
import { StepHeader } from './StepHeader';

/**
 * Step one: the mobile number.
 *
 * Nothing is decided here — the number goes to the backend, which says whether
 * it belongs to somebody and therefore which screen comes next.
 */
export function PhoneStep({
  defaultValue,
  isPending,
  error,
  onSubmit,
}: {
  defaultValue: string;
  isPending: boolean;
  error: AuthFlowError | null;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState(defaultValue);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(phone);
      }}
      className="space-y-6"
    >
      <StepHeader
        title="ورود یا ثبت‌نام"
        description="شماره موبایل خود را وارد کنید تا کد تأیید برایتان ارسال شود."
      />

      <FormField label="شماره موبایل" required error={error?.message}>
        <Input
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          autoFocus
          enterKeyHint="next"
          // Deliberately no `maxLength`: the browser would enforce it on the
          // raw text, cutting a pasted `+98 912 345 6789` down to eleven
          // characters before it could be normalised. `sanitizePhoneInput`
          // caps the digits after normalising, which is the only order that
          // accepts every spelling of an eleven-digit number.
          value={phone}
          onChange={(event) => setPhone(sanitizePhoneInput(event.target.value))}
          state={error ? 'error' : undefined}
          // rtl-ok: a phone number is read left-to-right in every locale.
          dir="ltr"
          className="text-center tracking-widest"
        />
      </FormField>

      <Button type="submit" loading={isPending} className="h-12 w-full text-base">
        ادامه
      </Button>
    </form>
  );
}
