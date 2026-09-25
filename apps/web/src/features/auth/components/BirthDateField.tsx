'use client';

import { useState } from 'react';

import {
  daysInJalaliMonth,
  isoToJalali,
  JALALI_MONTHS,
  jalaliToISO,
  toPersianDigits,
  type JalaliDate,
} from '@hamdastan/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@hamdastan/ui';
import { BIRTH_YEAR_MIN_JALALI } from '@hamdastan/validation';

import { FieldGroup } from './FieldGroup';

/**
 * Date of birth, in the calendar the user actually uses.
 *
 * Three dropdowns rather than a date input: a native picker renders in the
 * browser's own calendar, which for a Persian user is the wrong one — the field
 * asked for ۲۰ مرداد ۱۳۷۰ and offered 05/20/1990. Dropdowns also suit a birth
 * date better than a calendar to page through, since the year is the first
 * thing the user knows.
 *
 * The value handed up is always an ISO Gregorian date, because that is what the
 * backend stores and what `birthDateSchema` validates. The translation happens
 * in `@hamdastan/shared`.
 *
 * Nothing offered here can fail validation: the years stop at the current one,
 * and within it the months and days stop at today, so a date in the future
 * cannot be assembled in the first place.
 */

type Parts = { year: string; month: string; day: string };

/** Today in the Jalali calendar — the upper bound of every list below. */
function jalaliToday(): JalaliDate {
  return (
    isoToJalali(new Date().toISOString().slice(0, 10)) ?? {
      year: BIRTH_YEAR_MIN_JALALI,
      month: 12,
      day: 29,
    }
  );
}

/** Months selectable in a year: all of them, unless the year is this one. */
function monthCount(year: number, today: JalaliDate): number {
  return year === today.year ? today.month : 12;
}

/**
 * Days selectable in a month. Before a month is chosen there is no way to
 * know, so the longest is offered and a day that turns out not to exist is
 * dropped when the month arrives.
 */
function dayCount(year: number, month: number, today: JalaliDate): number {
  if (!year || !month) return 31;
  if (year === today.year && month === today.month) return today.day;
  return daysInJalaliMonth(year, month);
}

export function BirthDateField({
  value,
  onChange,
  error,
}: {
  /** ISO `YYYY-MM-DD`, or empty while the date is incomplete. */
  value: string;
  onChange: (isoDate: string) => void;
  error?: string;
}) {
  const [today] = useState(jalaliToday);

  // Newest first: most people signing up are nearer the recent end, and this
  // way their year is at the top rather than eighty rows down.
  const [years] = useState(() =>
    Array.from({ length: today.year - BIRTH_YEAR_MIN_JALALI + 1 }, (_, i) => today.year - i)
  );

  const [parts, setParts] = useState<Parts>(() => {
    const jalali = value ? isoToJalali(value) : null;
    return jalali
      ? { year: String(jalali.year), month: String(jalali.month), day: String(jalali.day) }
      : { year: '', month: '', day: '' };
  });

  const year = Number(parts.year);
  const month = Number(parts.month);

  /**
   * Applies one dropdown and reports the result.
   *
   * The ISO date is emitted from here rather than from an effect, so the parent
   * sees the change in the same update the user caused.
   */
  const choose = (field: keyof Parts, chosen: string) => {
    const next: Parts = { ...parts, [field]: chosen };
    const nextYear = Number(next.year);
    let nextMonth = Number(next.month);

    // Moving to the current year can strand a month that has not happened yet.
    if (nextYear && nextMonth > monthCount(nextYear, today)) {
      next.month = '';
      nextMonth = 0;
    }

    // Moving from Mordad to Mehr, or off a leap year, can strand the 31st.
    if (Number(next.day) > dayCount(nextYear, nextMonth, today)) {
      next.day = '';
    }

    setParts(next);

    const complete = next.year && next.month && next.day;
    onChange(
      complete
        ? (jalaliToISO({ year: nextYear, month: nextMonth, day: Number(next.day) }) ?? '')
        : ''
    );
  };

  return (
    <FieldGroup label="تاریخ تولد" required error={error}>
      {/*
        One row at every width. RTL puts the first column on the right, so this
        reads روز ماه سال — the order the date is spoken in. The triggers carry
        `min-w-0` because a grid column will otherwise refuse to shrink below
        its content and the row would overflow. The columns are uneven on
        purpose: a month name is far longer than two digits of a day, and equal
        thirds truncated "اردیبهشت" on a small phone.
      */}
      <div className="grid grid-cols-[0.85fr_1.45fr_1fr] gap-2">
        <Select value={parts.day} onValueChange={(next) => choose('day', next)}>
          <SelectTrigger className="h-11 w-full min-w-0 px-2" aria-label="روز تولد">
            <SelectValue placeholder="روز" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: dayCount(year, month, today) }, (_, i) => i + 1).map((day) => (
              <SelectItem key={day} value={String(day)}>
                {toPersianDigits(day)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={parts.month} onValueChange={(next) => choose('month', next)}>
          <SelectTrigger className="h-11 w-full min-w-0 px-2" aria-label="ماه تولد">
            <SelectValue placeholder="ماه" />
          </SelectTrigger>
          <SelectContent>
            {JALALI_MONTHS.slice(0, year ? monthCount(year, today) : 12).map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={parts.year} onValueChange={(next) => choose('year', next)}>
          <SelectTrigger className="h-11 w-full min-w-0 px-2" aria-label="سال تولد">
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
    </FieldGroup>
  );
}
