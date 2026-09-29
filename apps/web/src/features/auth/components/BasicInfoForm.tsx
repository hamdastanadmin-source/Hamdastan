'use client';

import { useMemo } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { PROFILE } from '@hamdastan/config';
import {
  JALALI_MONTHS,
  jalaliMonthLength,
  todayJalali,
} from '@hamdastan/shared/format/jalali';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from '@hamdastan/ui';
import {
  basicInfoSchema,
  type BasicInfoInput,
  type BasicInfoOutput,
} from '@hamdastan/validation';

import {
  Screen,
  ScreenBody,
  ScreenFooter,
  ScreenHeader,
  ScreenProgress,
  ScreenTitle,
} from '@/components';

import { AuthSteps } from './AuthSteps';
import { SignOutButton } from './SignOutButton';
import { useAuthActions } from '../hooks/use-auth-actions';
import { authErrorMessage } from '../utils/errors';

/**
 * Step three, and only for a new account: who this person is.
 *
 * The number is already verified by the time this renders, and the account
 * already exists — so closing the app here loses nothing, and the routing
 * table brings them back to this same screen. That is why there is no back
 * button: there is nothing behind it. The only way out is signing out.
 *
 * The date is three `<Select>`s rather than a date picker because a birthday
 * is a value the user knows, not one they navigate to; scrolling a calendar
 * back thirty years is the worse interaction by a distance.
 */

const GENDERS = [
  { value: 'male', label: 'مرد' },
  { value: 'female', label: 'زن' },
  { value: 'other', label: 'سایر' },
] as const;

/** The years that put the user inside the age range, newest first. */
function selectableYears(): number[] {
  const thisYear = todayJalali().year;
  const newest = thisYear - PROFILE.MIN_AGE;
  const oldest = thisYear - PROFILE.MAX_AGE;
  return Array.from({ length: newest - oldest + 1 }, (_, i) => newest - i);
}

/** Days in the chosen month, so 31 Esfand is never offered. */
function selectableDays(
  form: UseFormReturn<BasicInfoInput, unknown, BasicInfoOutput>
): number[] {
  const year = Number(form.watch('birthDate.year'));
  const month = Number(form.watch('birthDate.month'));
  const length =
    year && month ? jalaliMonthLength(year, month) : 31;
  return Array.from({ length }, (_, i) => i + 1);
}

/** Enter moves to the next field rather than submitting a half-filled form. */
function focusNextOnEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter') return;
  const target = event.target as HTMLElement;
  if (target.tagName !== 'INPUT') return;

  event.preventDefault();
  const fields = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>('input, button[role="combobox"]')
  );
  fields[fields.indexOf(target) + 1]?.focus();
}

export function BasicInfoForm() {
  const { saveBasicInfo } = useAuthActions();
  const years = useMemo(() => selectableYears(), []);

  // Three generics because the schema transforms: the Jalali parts go in,
  // a Gregorian ISO date comes out.
  const form = useForm<BasicInfoInput, unknown, BasicInfoOutput>({
    resolver: zodResolver(basicInfoSchema),
    // Errors appear when the user leaves a field, not while they are still
    // half-way through typing a name.
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      birthDate: { year: '', month: '', day: '' },
      gender: undefined,
    },
  });

  const days = selectableDays(form);

  const onSubmit = form.handleSubmit(async () => {
    try {
      // The *untransformed* values: the API parses with the same schema, so
      // it wants the Jalali parts, not the ISO date validation produced.
      await saveBasicInfo(form.getValues());
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  });

  return (
    <Screen>
      <ScreenHeader>
        <span />
        {/* Signing out is the only way off this screen — there is nothing
            behind it to go back to — and it is the same control the home
            screen uses, so it is the same component. */}
        <SignOutButton />
      </ScreenHeader>

      <ScreenProgress>
        <AuthSteps current={3} />
      </ScreenProgress>

      <ScreenBody>

        <Form {...form}>
          <form
            id="basic-info-form"
            onSubmit={onSubmit}
            onKeyDown={focusNextOnEnter}
            // Top-aligned, unlike the two screens before it: this form is
            // long enough to fill the column on a small phone, and centring
            // it would only move it down on a tall one — and then move it
            // again the moment a validation message appears.
            className="flex flex-col gap-6"
          >
            <ScreenTitle
              title="بیا آشنا بشیم"
              description="این اطلاعات پیش ما می‌مونه و به کسی نشون داده نمی‌شه."
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="given-name" className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام خانوادگی</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="family-name" className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormItem>
              <FormLabel asChild>
                <span>تاریخ تولد</span>
              </FormLabel>
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={form.control}
                  name="birthDate.day"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-12 w-full" aria-label="روز">
                        <SelectValue placeholder="روز" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={String(day)}>
                            {toPersianDigits(day)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate.month"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-12 w-full" aria-label="ماه">
                        <SelectValue placeholder="ماه" />
                      </SelectTrigger>
                      <SelectContent>
                        {JALALI_MONTHS.slice(1).map((month, index) => (
                          <SelectItem key={month} value={String(index + 1)}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="birthDate.year"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="h-12 w-full" aria-label="سال">
                        <SelectValue placeholder="سال" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {toPersianDigits(year)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {/* One message for the three parts: the rule they can break —
                  an impossible date, an age outside the range — is a property
                  of the date, not of any one dropdown. */}
              <FormField
                control={form.control}
                name="birthDate"
                render={() => <FormMessage />}
              />
            </FormItem>

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel asChild>
                    <span>جنسیت</span>
                  </FormLabel>
                  <FormControl>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      spacing={2}
                      value={field.value ?? ''}
                      onValueChange={(value) => value && field.onChange(value)}
                      className="grid w-full grid-cols-3"
                    >
                      {GENDERS.map(({ value, label }) => (
                        <ToggleGroupItem
                          key={value}
                          value={value}
                          // shadcn's `on` state is `bg-accent`, which on this
                          // dark surface is a shade away from the unselected
                          // one. A segmented control has to answer "which did
                          // I pick?" at a glance, so the chosen segment takes
                          // the primary fill.
                          className="h-12 text-base data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                        >
                          {label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </ScreenBody>

      <ScreenFooter>
        <Button
          type="submit"
          form="basic-info-form"
          size="xl"
          className="w-full"
          loading={form.formState.isSubmitting}
        >
          ادامه
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
