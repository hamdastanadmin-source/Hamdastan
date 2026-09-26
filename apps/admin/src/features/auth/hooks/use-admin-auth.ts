'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { HttpError } from '@/services';

import { adminAuthApi } from '../services/admin-auth.api';
import type { AdminAuthError } from '../types/admin-auth.types';

/**
 * The state machinery behind the two sign-in screens.
 *
 * The screens render; these hooks hold what is in flight and what came back.
 * Neither decides anything — the backend refuses a wrong password, an expired
 * account and a weak new password, and all these do is put the answer under the
 * right field.
 */

/** A backend failure, as the form should show it. */
function toAuthError(error: unknown, fallbackField: AdminAuthError['field']): AdminAuthError {
  if (error instanceof HttpError) {
    return {
      code: error.code,
      message: error.message,
      // A rejected credential belongs under the password box; everything else
      // — a suspended account, an expired one, a lockout — is about the
      // account rather than a field, so it goes above the form.
      field: error.code === 'ADMIN_INVALID_CREDENTIALS' ? fallbackField : 'form',
    };
  }

  return { message: 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.', field: 'form' };
}

export function useAdminLogin(): {
  login: (input: { username: string; password: string }) => void;
  isPending: boolean;
  error: AdminAuthError | null;
} {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AdminAuthError | null>(null);

  const login = useCallback(
    (input: { username: string; password: string }) => {
      setIsPending(true);
      setError(null);

      void adminAuthApi
        .login(input)
        .then(({ admin }) => {
          // Where they go next is the backend's answer, not a guess: an account
          // that still owes a password change can reach nothing else.
          router.replace(admin.mustChangePassword ? '/change-password' : '/');
          router.refresh();
        })
        .catch((caught: unknown) => {
          setError(toAuthError(caught, 'password'));
          setIsPending(false);
        });
    },
    [router]
  );

  return { login, isPending, error };
}

export function useChangePassword(): {
  changePassword: (input: { newPassword: string; confirmPassword: string }) => void;
  isPending: boolean;
  error: AdminAuthError | null;
} {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<AdminAuthError | null>(null);

  const changePassword = useCallback(
    (input: { newPassword: string; confirmPassword: string }) => {
      setIsPending(true);
      setError(null);

      void adminAuthApi
        .changePassword(input)
        .then(() => {
          router.replace('/');
          router.refresh();
        })
        .catch((caught: unknown) => {
          setError(toAuthError(caught, 'newPassword'));
          setIsPending(false);
        });
    },
    [router]
  );

  return { changePassword, isPending, error };
}

/**
 * Signs the admin out.
 *
 * The call goes to the backend because the backend issued the session cookie
 * and is the only thing that can invalidate the token behind it — clearing the
 * cookie alone would leave a usable session on the server.
 *
 * The redirect happens either way: if the request failed, the admin still asked
 * to leave, and the stale cookie is refused on its next use.
 */
export function useAdminLogout(): { logout: () => void; isPending: boolean } {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const logout = useCallback(() => {
    setIsPending(true);
    void adminAuthApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        router.replace('/login');
        router.refresh();
      });
  }, [router]);

  return { logout, isPending };
}
