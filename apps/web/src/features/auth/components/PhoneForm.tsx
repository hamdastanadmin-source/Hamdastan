'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { toLatinDigits } from '@hamdastan/shared/format/persian';
import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hamdastan/ui';
import {
  otpRequestSchema,
  type OtpRequestInput,
  type OtpRequestOutput,
} from '@hamdastan/validation';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';

import { useAuthActions } from '../hooks/use-auth-actions';
import { authErrorMessage } from '../utils/errors';

/**
 * Step one, and the same step for everybody: a phone number.
 *
 * The screen never asks whether this is a sign-in or a sign-up, because it
 * cannot know and does not need to — the API answers that after the code is
 * verified. Splitting the two here would mean guessing, and guessing wrong
 * means telling a stranger which numbers have accounts.
 */
export function PhoneForm() {
  const router = useRouter();
  const { requestOtp } = useAuthActions();

  // Three generics because the schema transforms: values in, values out.
  const form = useForm<OtpRequestInput, unknown, OtpRequestOutput>({
    resolver: zodResolver(otpRequestSchema),
    // Validates as the field is typed once it has been touched, so the button
    // enables the moment the number is complete rather than on blur.
    mode: 'onChange',
    defaultValues: { phone: '' },
  });

  const onSubmit = form.handleSubmit(async ({ phone }) => {
    try {
      await requestOtp(phone);
      router.push(`/auth/verify?phone=${encodeURIComponent(phone)}`);
    } catch (error) {
      // Rate limits and a dead network are about the request, not the field,
      // so they belong in a toast rather than under the input.
      toast.error(authErrorMessage(error));
    }
  });

  return (
    <Screen>
      <ScreenHeader />

      <ScreenBody>
        <Form {...form}>
          <form id="phone-form" onSubmit={onSubmit} className="flex flex-col gap-6">
            <header className="flex flex-col gap-2">
              <h1 className="text-2xl font-extrabold leading-tight">
                شماره موبایلت رو وارد کن
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                برای ورود یا ساخت حساب جدید
              </p>
            </header>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>شماره موبایل</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      // A phone number is digits, and digits keep their LTR
                      // order even on an RTL page.
                      dir="ltr"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      maxLength={13}
                      placeholder="09123456789"
                      className="h-12 text-lg tracking-widest"
                      onChange={(event) =>
                        // Persian keyboards produce ۰۹…; the value is stored
                        // as 09… from the first keystroke so what the user
                        // sees and what is validated are the same string.
                        field.onChange(toLatinDigits(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </ScreenBody>

      <ScreenFooter className="flex flex-col gap-3">
        <Button
          type="submit"
          form="phone-form"
          size="lg"
          className="h-12 w-full text-base font-bold"
          disabled={!form.formState.isValid}
          loading={form.formState.isSubmitting}
        >
          دریافت کد
        </Button>
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          با ادامه، قوانین و حریم خصوصی رو می‌پذیری
        </p>
      </ScreenFooter>
    </Screen>
  );
}
