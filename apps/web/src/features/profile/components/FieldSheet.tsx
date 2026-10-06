'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';

import { ACCOUNT_LIMITS } from '@hamdastan/config';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import {
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from '@hamdastan/ui';
import {
  bioSchema,
  citySchema,
  displayNameSchema,
  instagramSchema,
  linkedinSchema,
  telegramSchema,
  usernameSchema,
  z,
} from '@hamdastan/validation';

import { HttpError } from '@/services';

import { accountErrorMessage, useAccountActions } from '../hooks/use-account-actions';

/**
 * One profile field, edited in a bottom sheet: its label, the field, a line
 * of help, and «ذخیره تغییرات» — the sheet's one primary action — with
 * «انصراف» beside it, neutral.
 *
 * A field at a time rather than one long form: each save is small, and a
 * mistake is shown under the one field it belongs to — a taken username
 * included, which only the server can know.
 */

export type ProfileField = 'displayName' | 'username' | 'city' | 'bio' | 'instagram' | 'telegram' | 'linkedin';

const FIELDS: Record<
  ProfileField,
  {
    title: string;
    description: string;
    schema: z.ZodType<unknown, string>;
    multiline?: boolean;
    ltr?: boolean;
    placeholder?: string;
  }
> = {
  displayName: {
    title: 'نام',
    description: 'همون اسمی که بقیه توی هم‌داستان می‌بینن.',
    schema: displayNameSchema,
  },
  username: {
    title: 'نام کاربری',
    description: 'حروف انگلیسی، عدد، نقطه و _ — بین ۳ تا ۲۰ کاراکتر.',
    schema: usernameSchema,
    ltr: true,
    placeholder: 'username',
  },
  city: {
    title: 'شهر',
    description: 'برای پیشنهاد آدم‌ها و تجربه‌های نزدیک‌تر.',
    schema: citySchema,
    placeholder: 'مثلاً تهران',
  },
  bio: {
    title: 'درباره من',
    description: 'اختیاری — چند خط کوتاه درباره خودت.',
    schema: bioSchema,
    multiline: true,
  },
  instagram: {
    title: 'اینستاگرام',
    description: 'اختیاری — آیدی یا لینک پیجت.',
    schema: instagramSchema,
    ltr: true,
    placeholder: 'username',
  },
  telegram: {
    title: 'تلگرام',
    description: 'اختیاری — آیدی یا لینک تلگرامت.',
    schema: telegramSchema,
    ltr: true,
    placeholder: 'username',
  },
  linkedin: {
    title: 'لینکدین',
    description: 'اختیاری — آیدی یا لینک پروفایلت.',
    schema: linkedinSchema,
    ltr: true,
    placeholder: 'username',
  },
};

export function FieldSheet({
  field,
  initialValue,
  onClose,
}: {
  field: ProfileField | null;
  initialValue: string;
  onClose: () => void;
}) {
  return (
    <Sheet open={field !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        // rtl-ok: `side` names the physical edge the sheet rises from.
        side="bottom"
        showCloseButton={false}
        className="rounded-t-3xl border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Keyed by field, so each opening starts from the saved value. */}
        {field && <FieldForm key={field} field={field} initialValue={initialValue} onDone={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function FieldForm({
  field,
  initialValue,
  onDone,
}: {
  field: ProfileField;
  initialValue: string;
  onDone: () => void;
}) {
  const { updateProfile } = useAccountActions();
  const definition = FIELDS[field];
  const form = useForm<{ value: string }, unknown, { value: unknown }>({
    resolver: zodResolver(z.object({ value: definition.schema })),
    mode: 'onTouched',
    defaultValues: { value: initialValue },
  });
  const length = useWatch({ control: form.control, name: 'value' }).length;

  const onSubmit = form.handleSubmit(async () => {
    try {
      // The raw text: the API normalises with the same schema.
      await updateProfile({ [field]: form.getValues('value') });
      onDone();
    } catch (error) {
      if (error instanceof HttpError && (error.status === 409 || error.status === 400)) {
        form.setError('value', { message: error.message });
      } else {
        toast.error(accountErrorMessage(error));
      }
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col">
        <SheetHeader className="px-5 pt-6">
          <SheetTitle className="text-lg">{definition.title}</SheetTitle>
          <SheetDescription>{definition.description}</SheetDescription>
        </SheetHeader>

        <div className="px-5 py-2">
          <FormField
            control={form.control}
            name="value"
            render={({ field: input }) => (
              <FormItem>
                <FormControl>
                  {definition.multiline ? (
                    <Textarea
                      {...input}
                      rows={4}
                      maxLength={ACCOUNT_LIMITS.BIO_MAX}
                      aria-label={definition.title}
                      className="min-h-28"
                    />
                  ) : (
                    <Input
                      {...input}
                      aria-label={definition.title}
                      placeholder={definition.placeholder}
                      dir={definition.ltr ? 'ltr' : undefined}
                      autoCapitalize={definition.ltr ? 'none' : undefined}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-12"
                    />
                  )}
                </FormControl>
                {definition.multiline && (
                  <FormDescription className="text-end text-xs">
                    {toPersianDigits(length)} / {toPersianDigits(ACCOUNT_LIMITS.BIO_MAX)}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <SheetFooter className="gap-2 px-5 pb-5">
          <Button type="submit" size="xl" className="w-full" loading={form.formState.isSubmitting}>
            ذخیره تغییرات
          </Button>
          <Button type="button" variant="ghost" size="touch" className="w-full text-muted-foreground" onClick={onDone}>
            انصراف
          </Button>
        </SheetFooter>
      </form>
    </Form>
  );
}
