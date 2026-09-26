'use client';

import { useState } from 'react';

import type { AdminAccountStatus, AdminRoleCode, AdminUser } from '@hamdastan/types';
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
  FormField,
  Input,
  JalaliDateField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@hamdastan/ui';
import { updateAdminUserSchema } from '@hamdastan/validation';

import { useUpdateAdminUser } from '../hooks/use-admin-users';
import type { EditUserFormValues, UserFormError } from '../types/admin-users.types';
import { RoleSelect } from './RoleSelect';

/**
 * Only what the admin actually changed.
 *
 * Sending the whole form back would make an unrelated edit fail on an account
 * that has already expired: `accessExpiresAt` may not be a date in the past, so
 * renaming such an account would be refused for a field nobody touched. A PATCH
 * of the changed fields is both the honest request and the one that works.
 */
function changedFields(
  user: AdminUser,
  values: EditUserFormValues
): Partial<EditUserFormValues> {
  const original: EditUserFormValues = {
    firstName: user.firstName,
    lastName: user.lastName,
    mobile: user.mobile,
    roleCode: user.roleCode,
    accessExpiresAt: user.accessExpiresAt,
    status: user.status,
  };

  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) => value !== original[key as keyof EditUserFormValues]
    )
  );
}

/**
 * «ویرایش کاربر» — details, role, access expiry and status, in one dialog.
 *
 * The username is shown and not editable: it is what the credentials were sent
 * against and what the account is known by, so it is fixed at creation. The
 * password is not here at all — an admin's password is theirs, and the only
 * thing another admin can do to it is replace it with a temporary one, which is
 * `ResetPasswordDialog`.
 */
export function EditUserForm({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [values, setValues] = useState<EditUserFormValues>({
    firstName: user.firstName,
    lastName: user.lastName,
    mobile: user.mobile,
    roleCode: user.roleCode,
    accessExpiresAt: user.accessExpiresAt,
    status: user.status,
  });
  const [localError, setLocalError] = useState<UserFormError | null>(null);

  const { submit, isPending, error } = useUpdateAdminUser(user.id, () => {
    toast.success('تغییرات ذخیره شد');
    onOpenChange(false);
  });

  const shown = localError ?? error;
  const fieldError = (field: UserFormError['field']) =>
    shown?.field === field ? shown.message : undefined;

  const set = <K extends keyof EditUserFormValues>(key: K, value: EditUserFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ویرایش کاربر</DialogTitle>
          <DialogDescription>
            {/* rtl-ok: a username is Latin-only, so it reads left-to-right. */}
            نام کاربری <span dir="ltr" className="font-mono">{user.username}</span> پس از
            ساخت قابل تغییر نیست.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();

            const changes = changedFields(user, values);

            if (Object.keys(changes).length === 0) {
              setLocalError({ message: 'موردی برای تغییر وجود ندارد', field: 'form' });
              return;
            }

            const parsed = updateAdminUserSchema.safeParse(changes);
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

          <FormField label="وضعیت" required error={fieldError('form')}>
            <Select
              value={values.status}
              onValueChange={(next) => set('status', next as AdminAccountStatus)}
            >
              <SelectTrigger aria-label="وضعیت">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">فعال</SelectItem>
                <SelectItem value="SUSPENDED">غیرفعال</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={isPending}>
              ذخیره تغییرات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
