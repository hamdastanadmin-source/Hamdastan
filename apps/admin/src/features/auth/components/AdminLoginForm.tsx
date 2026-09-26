'use client';

import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
} from '@hamdastan/ui';
import { adminLoginSchema } from '@hamdastan/validation';

import { useAdminLogin } from '../hooks/use-admin-auth';
import type { AdminAuthError } from '../types/admin-auth.types';
import { PasswordField } from './PasswordField';

/**
 * The panel's front door.
 *
 * A username and a password — no mobile number, no one-time code, and no way to
 * register. Admin accounts are created by other admins, so this screen offers
 * nothing but signing in.
 *
 * It carries no logo and no product name. This is an internal tool reached by
 * people who know what they are signing in to, and a brand lockup on it is
 * decoration that has to be maintained.
 *
 * The schema check here only saves a round trip on an empty field; the backend
 * is what decides, and its answer is what the form shows.
 */
export function AdminLoginForm() {
  const { login, isPending, error } = useAdminLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<AdminAuthError | null>(null);

  const shown = localError ?? error;
  const fieldError = (field: AdminAuthError['field']) =>
    shown?.field === field ? shown.message : undefined;

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {/* No logo and no product name: the panel is an internal tool, and the
            card's own `text-start` puts the heading at the right in RTL. */}
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl">ورود به پنل مدیریت</CardTitle>
          <CardDescription>
            نام کاربری و رمز عبوری که برایتان ارسال شده است را وارد کنید.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            noValidate
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();

              const parsed = adminLoginSchema.safeParse({ username, password });
              if (!parsed.success) {
                const issue = parsed.error.issues[0];
                setLocalError({
                  message: issue.message,
                  field: issue.path[0] === 'password' ? 'password' : 'username',
                });
                return;
              }

              setLocalError(null);
              login(parsed.data);
            }}
          >
            {shown?.field === 'form' && (
              <Alert variant="destructive">
                <ShieldCheck className="size-4" />
                <AlertDescription>{shown.message}</AlertDescription>
              </Alert>
            )}

            <FormField label="نام کاربری" required error={fieldError('username')}>
              <Input
                name="username"
                autoComplete="username"
                autoFocus
                enterKeyHint="next"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                state={fieldError('username') ? 'error' : undefined}
                // rtl-ok: a username is Latin-only, so it reads left-to-right.
                dir="ltr"
                className="text-start"
              />
            </FormField>

            <PasswordField
              label="رمز عبور"
              name="password"
              value={password}
              onChange={setPassword}
              error={fieldError('password')}
              autoComplete="current-password"
              enterKeyHint="go"
            />

            <Button type="submit" loading={isPending} className="h-11 w-full text-base">
              ورود
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
