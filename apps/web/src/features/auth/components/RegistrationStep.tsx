'use client';

import { useState } from 'react';

import type { Gender } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Button,
  FormField,
  Input,
  RadioGroup,
  RadioGroupItem,
} from '@hamdastan/ui';

import type { AuthFlowError, RegistrationFormValues } from '../types/auth.types';
import { BirthDateField } from './BirthDateField';
import { FieldGroup } from './FieldGroup';
import { PhoneSummary } from './PhoneSummary';
import { StepHeader } from './StepHeader';

/**
 * Step two, for a number nobody has used yet: who is this?
 *
 * Submitting it does not create an account. The profile is held by the backend
 * against a one-time code, and only a verified code turns it into a user.
 */

const GENDERS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: 'FEMALE', label: 'زن' },
  { value: 'MALE', label: 'مرد' },
];

export function RegistrationStep({
  phone,
  isPending,
  error,
  onSubmit,
  onEditPhone,
}: {
  phone: string;
  isPending: boolean;
  error: AuthFlowError | null;
  onSubmit: (values: RegistrationFormValues) => void;
  onEditPhone: () => void;
}) {
  const [values, setValues] = useState<RegistrationFormValues>({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
  });

  const update = <K extends keyof RegistrationFormValues>(
    key: K,
    value: RegistrationFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(values);
      }}
      className="space-y-6"
    >
      <StepHeader
        title="تکمیل ثبت‌نام"
        description="این شماره تازه است. برای ساخت حساب، اطلاعات زیر را وارد کنید."
      />

      <PhoneSummary phone={phone} onEdit={onEditPhone} disabled={isPending} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="نام" required>
          <Input
            name="firstName"
            autoComplete="given-name"
            autoFocus
            value={values.firstName}
            onChange={(event) => update('firstName', event.target.value)}
          />
        </FormField>

        <FormField label="نام خانوادگی" required>
          <Input
            name="lastName"
            autoComplete="family-name"
            value={values.lastName}
            onChange={(event) => update('lastName', event.target.value)}
          />
        </FormField>
      </div>

      <BirthDateField
        value={values.birthDate}
        onChange={(isoDate) => update('birthDate', isoDate)}
      />

      <FieldGroup label="جنسیت" required>
        <RadioGroup
          name="gender"
          value={values.gender}
          onValueChange={(value) => update('gender', value as Gender)}
          className="grid-cols-2 gap-3"
        >
          {GENDERS.map(({ value, label }) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-input px-3 py-2.5 text-sm transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
            >
              <RadioGroupItem value={value} />
              {label}
            </label>
          ))}
        </RadioGroup>
      </FieldGroup>

      {/* A field rule or "this number is already registered" — neither maps
          onto a single input, so both belong above the button. */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" loading={isPending} className="h-12 w-full text-base">
        ادامه
      </Button>
    </form>
  );
}
