'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import type { BasicInfoInput } from '@hamdastan/validation';

import { NEXT_STEP_PATH } from '@/lib';
import { authService } from '@/services';

/**
 * The calls the sign-in flow makes, plus the navigation each one ends
 * in.
 *
 * The screens call these rather than the service directly, which is what
 * keeps the components free of both the endpoint names and the routing
 * table: a form knows it submitted successfully, not where that leads.
 *
 * Errors are re-thrown. The screen is the only thing that knows whether a
 * failure belongs under the field, in a toast, or in a shake of the OTP
 * boxes.
 */

export function useAuthActions() {
  const router = useRouter();

  const requestOtp = useCallback(
    async (phone: string): Promise<number> => {
      const { resendIn } = await authService.requestOtp(phone);
      return resendIn;
    },
    []
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string): Promise<void> => {
      const { nextStep } = await authService.verifyOtp(phone, code);
      // `replace`, not `push`: the code screen must not be reachable with the
      // back button once it has been spent.
      router.replace(NEXT_STEP_PATH[nextStep]);
      // The layout above re-reads the session on the server.
      router.refresh();
    },
    [router]
  );

  const saveBasicInfo = useCallback(
    async (input: BasicInfoInput): Promise<void> => {
      const { nextStep } = await authService.updateBasicInfo(input);
      router.replace(NEXT_STEP_PATH[nextStep]);
      router.refresh();
    },
    [router]
  );

  const saveUsername = useCallback(
    async (username: string): Promise<void> => {
      const { nextStep } = await authService.confirmUsername(username);
      router.replace(NEXT_STEP_PATH[nextStep]);
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
    router.replace('/welcome');
    router.refresh();
  }, [router]);

  return { requestOtp, verifyOtp, saveBasicInfo, saveUsername, logout };
}
