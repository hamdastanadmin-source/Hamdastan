'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ADMIN_ERROR_CODES } from '@hamdastan/types';
import { toMobileInput } from '@hamdastan/shared/format/persian';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hamdastan/ui';
import { otpRequestSchema, type OtpRequestInput, type OtpRequestOutput } from '@hamdastan/validation';

import { errorCode, errorMessage } from '@/lib';

import { useAdminAuth } from '../hooks/use-admin-auth';
import { OtpStep } from './OtpStep';

type CodeStep = { phone: string; resendIn: number; attempt: number };

/**
 * Admin sign-in: a mobile number, then the code sent to it.
 *
 * There is no sign-up. Whether the number may enter is answered by the API
 * after the code verifies; a number that is not an active admin comes back
 * here with the reason.
 */
export function LoginForm() {
  const { requestOtp, verifyOtp } = useAdminAuth();
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const form = useForm<OtpRequestInput, unknown, OtpRequestOutput>({
    resolver: zodResolver(otpRequestSchema),
    mode: 'onChange',
    defaultValues: { phone: '' },
  });

  const sendCode = async (phone: string, attempt: number) => {
    const { resendIn } = await requestOtp(phone);
    setCodeStep({ phone, resendIn, attempt });
  };

  const onSubmit = form.handleSubmit(async ({ phone }) => {
    setDenied(null);
    try {
      await sendCode(phone, 0);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  });

  const verify = async (code: string) => {
    if (!codeStep) return;
    try {
      await verifyOtp(codeStep.phone, code);
    } catch (error) {
      if (errorCode(error) !== ADMIN_ERROR_CODES.ADMIN_ACCESS_DENIED) throw error;
      // The code was right but the number has no access: back to the start.
      setDenied(errorMessage(error));
      setCodeStep(null);
    }
  };

  const resend = async () => {
    if (!codeStep) return;
    try {
      await sendCode(codeStep.phone, codeStep.attempt + 1);
      toast.success('کد دوباره فرستاده شد');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">ورود به پنل مدیریت</CardTitle>
        <CardDescription>
          {codeStep ? 'کد تأیید رو وارد کن' : 'فقط کاربرانی که مدیر ثبت کرده می‌تونن وارد بشن'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {codeStep ? (
          <OtpStep
            key={codeStep.attempt}
            phone={codeStep.phone}
            resendIn={codeStep.resendIn}
            onVerify={verify}
            onResend={resend}
            onEditPhone={() => setCodeStep(null)}
          />
        ) : (
          <Form {...form}>
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {denied && (
                <Alert variant="destructive">
                  <ShieldAlert aria-hidden="true" />
                  <AlertTitle>دسترسی نداری</AlertTitle>
                  <AlertDescription>{denied}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شماره موبایل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        autoFocus
                        placeholder="09123456789"
                        className="h-11 text-base tracking-wider tabular-nums"
                        onChange={(event) => field.onChange(toMobileInput(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                size="lg"
                disabled={!form.formState.isValid}
                loading={form.formState.isSubmitting}
              >
                دریافت کد
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
