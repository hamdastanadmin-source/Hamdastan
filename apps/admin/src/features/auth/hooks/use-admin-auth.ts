'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

import type { OtpRequestResponse } from '@hamdastan/types';

import { adminAuthService } from '@/services';

/**
 * The admin sign-in calls, plus where each one ends. Errors are re-thrown:
 * the screen decides whether a failure is a toast or a line under the field.
 */
export function useAdminAuth() {
  const router = useRouter();

  const requestOtp = useCallback(
    (phone: string): Promise<OtpRequestResponse> => adminAuthService.requestOtp(phone),
    []
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string): Promise<void> => {
      await adminAuthService.verifyOtp(phone, code);
      // `replace`: the spent code screen must not be reachable with Back.
      router.replace('/users');
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async (): Promise<void> => {
    await adminAuthService.logout();
    router.replace('/login');
    router.refresh();
  }, [router]);

  return { requestOtp, verifyOtp, logout };
}
