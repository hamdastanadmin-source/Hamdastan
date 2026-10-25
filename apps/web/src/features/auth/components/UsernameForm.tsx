'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

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
  Spinner,
} from '@hamdastan/ui';
import {
  USERNAME_HINT,
  USERNAME_TAKEN_MESSAGE,
  usernameChoiceSchema,
  type UsernameChoiceInput,
  type UsernameChoiceOutput,
} from '@hamdastan/validation';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';
import { HttpError } from '@/services';

import { useAuthActions } from '../hooks/use-auth-actions';
import { useUsernameAvailability } from '../hooks/use-username-availability';
import { authErrorMessage } from '../utils/errors';

/**
 * Step four, right after basic info: the name the person is known by.
 *
 * The account was born with a generated one, so the field starts filled and
 * «ادامه» works straight away — keeping it is a valid answer. Like the
 * basic-info form, there is no way back: the routing table holds them here
 * until they answer, and the profile can change the name later.
 *
 * Whether a typed name is free is checked as they type, so a taken one is
 * flagged before «ادامه» rather than after it.
 */
export function UsernameForm({ initialUsername }: { initialUsername: string }) {
  const { saveUsername } = useAuthActions();

  const form = useForm<UsernameChoiceInput, unknown, UsernameChoiceOutput>({
    resolver: zodResolver(usernameChoiceSchema),
    mode: 'onTouched',
    defaultValues: { username: initialUsername },
  });
  const availability = useUsernameAvailability(
    useWatch({ control: form.control, name: 'username' })
  );
  const taken = availability === 'taken';

  const onSubmit = form.handleSubmit(async () => {
    try {
      // The raw text: the API normalises with the same schema.
      await saveUsername(form.getValues('username'));
    } catch (error) {
      // A taken name is only the server's to know, and it belongs under the field.
      if (error instanceof HttpError && (error.status === 409 || error.status === 400)) {
        form.setError('username', { message: error.message });
      } else {
        toast.error(authErrorMessage(error));
      }
    }
  });

  return (
    <Screen>
      <ScreenHeader />

      <ScreenBody>
        <Form {...form}>
          <form id="username-form" onSubmit={onSubmit} className="flex flex-col gap-6">
            <ScreenTitle
              title="یه نام کاربری برای خودت انتخاب کن"
              description="توی هم‌داستان با این نام شناخته می‌شی و بقیه کنار فعالیت‌ها و پروفایلت می‌بیننش. یکی برات ساختیم؛ اگه دوستش نداری، اسم دلخواهت رو بنویس. بعداً هم از پروفایلت می‌تونی عوضش کنی."
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>نام کاربری</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="username"
                      dir="ltr"
                      autoCapitalize="none"
                      autoComplete="username"
                      spellCheck={false}
                      aria-invalid={taken || fieldState.invalid}
                      className="h-12"
                    />
                  </FormControl>
                  <FormDescription>{USERNAME_HINT}</FormDescription>
                  <div aria-live="polite">
                    <FormMessage>{taken ? USERNAME_TAKEN_MESSAGE : null}</FormMessage>
                    {!fieldState.error && availability === 'checking' && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Spinner className="size-4" />
                        در حال بررسی…
                      </p>
                    )}
                    {!fieldState.error && availability === 'available' && (
                      <p className="flex items-center gap-1.5 text-sm text-success">
                        <Check className="size-4" aria-hidden />
                        این نام کاربری آزاده
                      </p>
                    )}
                  </div>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </ScreenBody>

      <ScreenFooter>
        <Button
          type="submit"
          form="username-form"
          size="xl"
          className="w-full"
          disabled={!form.formState.isValid || taken}
          loading={form.formState.isSubmitting}
        >
          ادامه
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
