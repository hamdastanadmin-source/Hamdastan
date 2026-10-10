'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import type { NextStep } from '@hamdastan/types';
import type { BasicInfoInput } from '@hamdastan/validation';

import { authService } from '@/services';

/**
 * The three calls the sign-in flow makes, plus the navigation each one ends
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

/** Where the server says to go, as a path. */
const PATH_FOR: Record<NextStep, string> = {
  basic_info: '/auth/basic-info',
  onboarding: '/onboarding',
  home: '/',
};

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
      router.replace(PATH_FOR[nextStep]);
      // The layout above re-reads the session on the server.
      router.refresh();
    },
    [router]
  );

  const saveBasicInfo = useCallback(
    async (input: BasicInfoInput): Promise<void> => {
      const { nextStep } = await authService.updateBasicInfo(input);
      router.replace(PATH_FOR[nextStep]);
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async (): Promise<void> => {
    await authService.logout();
    router.replace('/welcome');
    router.refresh();
  }, [router]);

  return { requestOtp, verifyOtp, saveBasicInfo, logout };
}
