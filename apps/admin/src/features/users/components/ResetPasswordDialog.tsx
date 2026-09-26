'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

import type { AdminUser, CreateAdminUserResponse } from '@hamdastan/types';
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
} from '@hamdastan/ui';

import { useResetTemporaryPassword } from '../hooks/use-admin-users';
import { CredentialsNotice } from './CredentialsNotice';

/**
 * «بازنشانی رمز موقت» — and, for the same reason, «ارسال مجدد اطلاعات ورود».
 *
 * They are one operation because a stored password cannot be read back: the
 * backend keeps only a hash, so there is nothing to re-send. What it can do is
 * generate a new temporary password, invalidate the old one, sign the account
 * out everywhere and text the new credentials — which is what this does, and
 * why it asks first.
 */
export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [result, setResult] = useState<CreateAdminUserResponse | null>(null);
  const { submit, isPending, error } = useResetTemporaryPassword(user.id, setResult);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            بازنشانی رمز عبور موقت
          </DialogTitle>
          <DialogDescription>
            برای «{user.fullName}» یک رمز عبور موقت جدید ساخته و پیامک می‌شود.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <CredentialsNotice result={result} />
            <DialogFooter>
              <Button onClick={() => close(false)}>بستن</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertDescription>
                رمز عبور فعلی این کاربر بی‌اعتبار می‌شود، نشست‌های فعالش بسته می‌شود و
                در ورود بعدی باید رمز جدیدی انتخاب کند. رمز قبلی قابل بازیابی نیست.
              </AlertDescription>
            </Alert>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                انصراف
              </Button>
              <Button loading={isPending} onClick={() => submit()}>
                ساخت رمز موقت جدید
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
