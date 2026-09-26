'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import type {
  CreateAdminUserRequest,
  CreateAdminUserResponse,
  UpdateAdminUserRequest,
} from '@hamdastan/types';

import { HttpError } from '@/services';

import { adminUsersApi } from '../services/admin-users.api';
import type { UserFormError } from '../types/admin-users.types';

/**
 * The state machinery behind the dialogs on «مدیریت کاربران».
 *
 * The table itself is rendered on the server and re-read with
 * `router.refresh()` after a change, so there is no client-side copy of the
 * list to keep in step with the backend — the backend is the copy.
 *
 * Nothing here decides anything: a duplicate username, a role that does not
 * exist and an expiry in the past are all refused by `apps/api`, and these
 * hooks only put the answer where the form can show it.
 */

/** A backend failure, as the form should show it. */
function toFormError(error: unknown): UserFormError {
  if (error instanceof HttpError) {
    return {
      message: error.message,
      // A taken username is the one failure that belongs under a field.
      field: error.code === 'CONFLICT' ? 'username' : 'form',
    };
  }

  return { message: 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.', field: 'form' };
}

type Mutation<TInput> = {
  submit: (input: TInput) => void;
  isPending: boolean;
  error: UserFormError | null;
  reset: () => void;
};

/**
 * One shape for all three mutations.
 *
 * Creating, editing and resetting differ only in which call they make and what
 * they hand back, so the pending flag, the error mapping and the refresh live
 * here once rather than three times.
 */
function useMutation<TInput, TResult>(
  call: (input: TInput) => Promise<TResult>,
  onDone: (result: TResult) => void
): Mutation<TInput> {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<UserFormError | null>(null);

  const submit = useCallback(
    (input: TInput) => {
      setIsPending(true);
      setError(null);

      void call(input)
        .then((result) => {
          onDone(result);
          // The list is server-rendered, so this is what makes the change show.
          router.refresh();
        })
        .catch((caught: unknown) => setError(toFormError(caught)))
        .finally(() => setIsPending(false));
    },
    [call, onDone, router]
  );

  return { submit, isPending, error, reset: () => setError(null) };
}

export function useCreateAdminUser(
  onCreated: (result: CreateAdminUserResponse) => void
): Mutation<CreateAdminUserRequest> {
  return useMutation(
    useCallback((input: CreateAdminUserRequest) => adminUsersApi.create(input), []),
    onCreated
  );
}

export function useUpdateAdminUser(
  id: string,
  onUpdated: () => void
): Mutation<UpdateAdminUserRequest> {
  return useMutation(
    useCallback((patch: UpdateAdminUserRequest) => adminUsersApi.update(id, patch), [id]),
    onUpdated
  );
}

export function useResetTemporaryPassword(
  id: string,
  onReset: (result: CreateAdminUserResponse) => void
): Mutation<void> {
  return useMutation(
    useCallback(() => adminUsersApi.resetPassword(id), [id]),
    onReset
  );
}
