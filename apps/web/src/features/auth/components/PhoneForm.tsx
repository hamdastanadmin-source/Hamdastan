'use client';

import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { OTP } from '@hamdastan/config';
import { toLatinDigits, toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
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

import {
  Screen,
  ScreenBack,
  ScreenBody,
  ScreenProgress,
  ScreenFooter,
  ScreenHeader,
  ScreenTitle,
} from '@/components';

import { AuthSteps } from './AuthSteps';
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
      <ScreenHeader>
        <ScreenBack href="/welcome" />
      </ScreenHeader>

      <ScreenProgress>
        <AuthSteps current={1} />
      </ScreenProgress>

      <ScreenBody center>
        <Form {...form}>
          <form id="phone-form" onSubmit={onSubmit} className="flex flex-col gap-6">
            <ScreenTitle
              title="شماره موبایلت رو وارد کن"
              description="برای ورود یا ساخت حساب جدید"
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>شماره موبایل</FormLabel>
                  {/* `dir="ltr"` on the wrapper, not just the input: a
                      phone number keeps Latin digit order, so the icon that
                      marks the start of it has to sit on the same side the
                      digits begin.
                      With the wrapper left in RTL, `start-4` would put the
                      icon against the right edge and the field's own
                      `ps-12` would clear space on the left. */}
                  <div dir="ltr" className="relative">
                    {/* Decorative: the label already names the field, so the
                        icon is an affix rather than a second thing to read
                        or tab to. */}
                    <Phone
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-muted-foreground"
                    />
                    {/* FormControl stays wrapped around the input itself —
                        it is what hands the field its id, `aria-describedby`
                        and `aria-invalid`, and those belong on the control,
                        not on a positioning div. */}
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        maxLength={13}
                        placeholder="09123456789"
                        className="h-12 ps-12 text-lg tracking-wider tabular-nums"
                        onChange={(event) =>
                          // Persian keyboards produce ۰۹…; the value is stored
                          // as 09… from the first keystroke so what the user
                          // sees and what is validated are the same string.
                          field.onChange(toLatinDigits(event.target.value))
                        }
                      />
                    </FormControl>
                  </div>
                  {/* Reserved: the body is centred, so a message appearing
                      here would otherwise lift the field out from under the
                      user's finger at the moment they mistyped. */}
                  <div className="min-h-5">
                    <FormDescription>
                      یک کد {toPersianDigits(OTP.LENGTH)} رقمی برات پیامک می‌شه.
                    </FormDescription>
                    <FormMessage />
                  </div>
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
          size="xl"
          className="w-full"
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
