'use client';

import * as React from 'react';

import {
  daysInJalaliMonth,
  isoToJalali,
  JALALI_MONTHS,
  jalaliToISO,
  toPersianDigits,
  type JalaliDate,
} from '@hamdastan/shared';

import { FormField } from '../primitives/form-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components';

/**
 * A date, in the calendar the user actually reads.
 *
 * Three dropdowns rather than a date input: a native picker renders in the
 * browser's own calendar, which for a Persian user is the wrong one — it asks
 * for ۲۰ مرداد ۱۴۰۴ and offers 08/11/2025.
 *
 * The value handed up is always an ISO Gregorian date, because that is what the
 * backend stores and every schema validates. The translation happens in
 * `@hamdastan/shared`, which is the only place in the project that converts
 * between the two calendars.
 *
 * It lives in the design system because more than one feature collects a date:
 * an admin account's access expiry and a form's availability window are the
 * same control with different bounds.
 */

export type JalaliDateSelectProps = {
  /** Names the three dropdowns for a screen reader. */
  label: string;
  /** ISO `YYYY-MM-DD`, or empty while the date is incomplete. */
  value: string;
  onChange: (isoDate: string) => void;
  /** How many Jalali years back the list starts. 0 means "this year". */
  yearsBack?: number;
  /** How many years forward it runs. */
  yearsAhead?: number;
  disabled?: boolean;
};

export type JalaliDateFieldProps = JalaliDateSelectProps & {
  error?: string;
  required?: boolean;
  helperText?: string;
};

function jalaliToday(): JalaliDate {
  return (
    isoToJalali(new Date().toISOString().slice(0, 10)) ?? { year: 1404, month: 1, day: 1 }
  );
}

/**
 * The three dropdowns on their own, for somewhere that already has a label —
 * a form question, which renders its own title above the control.
 */
export function JalaliDateSelect({
  label,
  value,
  onChange,
  yearsBack = 0,
  yearsAhead = 10,
  disabled,
}: JalaliDateSelectProps) {
  const [today] = React.useState(jalaliToday);

  const years = React.useMemo(
    () =>
      Array.from(
        { length: yearsBack + yearsAhead + 1 },
        (_, index) => today.year - yearsBack + index
      ),
    [today.year, yearsAhead, yearsBack]
  );

  const parts = value ? isoToJalali(value) : null;
  const year = parts?.year ?? 0;
  const month = parts?.month ?? 0;
  const day = parts?.day ?? 0;

  /** Rebuilds the ISO value, clamping a day the new month does not have. */
  const update = (next: Partial<JalaliDate>) => {
    const candidate = { year, month, day, ...next };
    if (!candidate.year || !candidate.month || !candidate.day) return;

    const lastDay = daysInJalaliMonth(candidate.year, candidate.month);
    const iso = jalaliToISO({ ...candidate, day: Math.min(candidate.day, lastDay) });
    if (iso) onChange(iso);
  };

  const dayCount = year && month ? daysInJalaliMonth(year, month) : 31;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Select
        value={day ? String(day) : undefined}
        onValueChange={(next) => update({ day: Number(next) })}
        disabled={disabled}
      >
        <SelectTrigger aria-label={`روز — ${label}`}>
          <SelectValue placeholder="روز" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: dayCount }, (_, index) => index + 1).map((candidate) => (
            <SelectItem key={candidate} value={String(candidate)}>
              {toPersianDigits(candidate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={month ? String(month) : undefined}
        onValueChange={(next) => update({ month: Number(next), day: day || 1 })}
        disabled={disabled}
      >
        <SelectTrigger aria-label={`ماه — ${label}`}>
          <SelectValue placeholder="ماه" />
        </SelectTrigger>
        <SelectContent>
          {JALALI_MONTHS.map((name, index) => (
            <SelectItem key={name} value={String(index + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year ? String(year) : undefined}
        onValueChange={(next) => update({ year: Number(next), month: month || 1, day: day || 1 })}
        disabled={disabled}
      >
        <SelectTrigger aria-label={`سال — ${label}`}>
          <SelectValue placeholder="سال" />
        </SelectTrigger>
        <SelectContent>
          {years.map((candidate) => (
            <SelectItem key={candidate} value={String(candidate)}>
              {toPersianDigits(candidate)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The same control with a label, an error and the required marker around it. */
export function JalaliDateField({
  error,
  required,
  helperText,
  ...select
}: JalaliDateFieldProps) {
  return (
    <FormField label={select.label} required={required} error={error} helperText={helperText}>
      <JalaliDateSelect {...select} />
    </FormField>
  );
}
