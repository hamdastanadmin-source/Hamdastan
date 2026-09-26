'use client';

import { useState } from 'react';
import { Check, KeyRound, X } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hamdastan/ui';
import { ADMIN_PASSWORD_RULES, adminChangePasswordSchema } from '@hamdastan/validation';

import { useChangePassword } from '../hooks/use-admin-auth';
import type { AdminAuthError } from '../types/admin-auth.types';
import { PasswordField } from './PasswordField';

/**
 * The forced password change.
 *
 * It is the only screen an admin on a temporary password can reach: the backend
 * refuses every other route until this succeeds, and the dashboard layout
 * redirects here, so the two agree without the guard living in the UI.
 *
 * The checklist and the schema read the same rules from
 * `@hamdastan/validation`, so the ticks a user watches cannot say one thing
 * while the backend says another.
 */
export function ChangePasswordForm() {
  const { changePassword, isPending, error } = useChangePassword();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<AdminAuthError | null>(null);

  const shown = localError ?? error;
  const fieldError = (field: AdminAuthError['field']) =>
    shown?.field === field ? shown.message : undefined;

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" />
            <CardTitle className="text-xl">تغییر رمز عبور</CardTitle>
          </div>
          <CardDescription>
            رمز عبور فعلی شما موقت است. برای ادامه، یک رمز عبور جدید انتخاب کنید.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              const parsed = adminChangePasswordSchema.safeParse({
                newPassword,
                confirmPassword,
              });

              if (!parsed.success) {
                const issue = parsed.error.issues[0];
                setLocalError({
                  message: issue.message,
                  field: issue.path[0] === 'confirmPassword' ? 'confirmPassword' : 'newPassword',
                });
                return;
              }

              setLocalError(null);
              changePassword(parsed.data);
            }}
          >
            {shown?.field === 'form' && (
              <Alert variant="destructive">
                <AlertDescription>{shown.message}</AlertDescription>
              </Alert>
            )}

            <PasswordField
              label="رمز عبور جدید"
              name="newPassword"
              value={newPassword}
              onChange={setNewPassword}
              error={fieldError('newPassword')}
              autoFocus
            />

            <ul className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              {ADMIN_PASSWORD_RULES.map((rule) => {
                const met = rule.test(newPassword);
                return (
                  <li
                    key={rule.id}
                    className={`flex items-center gap-2 text-xs ${
                      met ? 'text-success' : 'text-muted-foreground'
                    }`}
                  >
                    {met ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    <span>{rule.label}</span>
                  </li>
                );
              })}
            </ul>

            <PasswordField
              label="تکرار رمز عبور جدید"
              name="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={fieldError('confirmPassword')}
            />

            <Button type="submit" loading={isPending} className="h-11 w-full text-base">
              ثبت رمز عبور جدید
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
