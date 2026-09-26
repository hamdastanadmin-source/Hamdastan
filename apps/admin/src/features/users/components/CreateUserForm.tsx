'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';

import type { AdminRoleCode, CreateAdminUserResponse } from '@hamdastan/types';
import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  JalaliDateField,
} from '@hamdastan/ui';
import { createAdminUserSchema } from '@hamdastan/validation';

import { useCreateAdminUser } from '../hooks/use-admin-users';
import type { CreateUserFormValues, UserFormError } from '../types/admin-users.types';
import { CredentialsNotice } from './CredentialsNotice';
import { RoleSelect } from './RoleSelect';

/**
 * «ایجاد کاربر» — the dialog that creates an admin account.
 *
 * It collects six fields and nothing else. In particular it does not collect a
 * password: the backend generates a six-digit temporary one, stores only its
 * hash and texts it to the number given here. What comes back is a report of
 * whether that message went out — see `CredentialsNotice`.
 *
 * The schema it parses with is the one `apps/api` parses with, so a field error
 * shown here is the error the backend would have given.
 */

const EMPTY: CreateUserFormValues = {
  firstName: '',
  lastName: '',
  username: '',
  mobile: '',
  roleCode: '',
  accessExpiresAt: '',
};

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<CreateUserFormValues>(EMPTY);
  const [localError, setLocalError] = useState<UserFormError | null>(null);
  const [created, setCreated] = useState<CreateAdminUserResponse | null>(null);

  const { submit, isPending, error } = useCreateAdminUser((result) => {
    // The dialog stays open on success: the credentials report is the point of
    // the whole exercise, and closing it would throw the only copy away.
    setCreated(result);
    setValues(EMPTY);
  });

  const shown = localError ?? error;
  const fieldError = (field: UserFormError['field']) =>
    shown?.field === field ? shown.message : undefined;

  const set = <K extends keyof CreateUserFormValues>(
    key: K,
    value: CreateUserFormValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }));

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setValues(EMPTY);
      setLocalError(null);
      setCreated(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          ایجاد کاربر
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ایجاد کاربر جدید</DialogTitle>
          <DialogDescription>
            رمز عبور موقت توسط سامانه ساخته و به شمارهٔ موبایل کاربر پیامک می‌شود.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <CredentialsNotice result={created} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreated(null)}>
                ایجاد کاربر دیگر
              </Button>
              <Button onClick={() => close(false)}>بستن</Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();

              const parsed = createAdminUserSchema.safeParse(values);
              if (!parsed.success) {
                const issue = parsed.error.issues[0];
                setLocalError({
                  message: issue.message,
                  field: (issue.path[0] as UserFormError['field']) ?? 'form',
                });
                return;
              }

              setLocalError(null);
              submit(parsed.data);
            }}
          >
            {shown?.field === 'form' && (
              <Alert variant="destructive">
                <AlertDescription>{shown.message}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="نام" required error={fieldError('firstName')}>
                <Input
                  name="firstName"
                  value={values.firstName}
                  onChange={(event) => set('firstName', event.target.value)}
                  state={fieldError('firstName') ? 'error' : undefined}
                />
              </FormField>

              <FormField label="نام خانوادگی" required error={fieldError('lastName')}>
                <Input
                  name="lastName"
                  value={values.lastName}
                  onChange={(event) => set('lastName', event.target.value)}
                  state={fieldError('lastName') ? 'error' : undefined}
                />
              </FormField>
            </div>

            <FormField
              label="نام کاربری"
              required
              error={fieldError('username')}
              helperText="فقط حرف انگلیسی، رقم، نقطه، خط تیره و زیرخط. پس از ساخت قابل تغییر نیست."
            >
              <Input
                name="username"
                value={values.username}
                onChange={(event) => set('username', event.target.value)}
                state={fieldError('username') ? 'error' : undefined}
                // rtl-ok: a username is Latin-only, so it reads left-to-right.
                dir="ltr"
                className="text-start"
              />
            </FormField>

            <FormField label="شماره موبایل" required error={fieldError('mobile')}>
              <Input
                name="mobile"
                type="tel"
                inputMode="numeric"
                value={values.mobile}
                onChange={(event) => set('mobile', event.target.value)}
                state={fieldError('mobile') ? 'error' : undefined}
                // rtl-ok: a phone number is read left-to-right in every locale.
                dir="ltr"
                className="text-start"
              />
            </FormField>

            <RoleSelect
              value={values.roleCode}
              onChange={(role: AdminRoleCode) => set('roleCode', role)}
              error={fieldError('roleCode')}
            />

            <JalaliDateField
              label="اعتبار دسترسی تا"
              required
              value={values.accessExpiresAt}
              onChange={(iso) => set('accessExpiresAt', iso)}
              error={fieldError('accessExpiresAt')}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                انصراف
              </Button>
              <Button type="submit" loading={isPending}>
                ایجاد کاربر
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
