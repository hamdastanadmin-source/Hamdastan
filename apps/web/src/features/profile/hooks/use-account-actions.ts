'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { AccountUpdate } from '@hamdastan/types';
import type { AvatarInput, ProfileUpdateInput, SettingsInput } from '@hamdastan/validation';
import { toPersianDigits } from '@hamdastan/shared/format/persian';

import { HttpError, accountService } from '@/services';

/**
 * The account area's writes, plus what each one ends in — a refresh of the
 * server-rendered screen, a way back to the hub, a word of confirmation.
 *
 * Errors are re-thrown: only the screen knows whether a failure belongs
 * under a field (a taken username) or in a toast.
 */

export function accountErrorMessage(error: unknown): string {
  // The API answers in Persian; only "never arrived" needs our wording.
  return error instanceof HttpError ? error.message : 'ارتباط با سرور برقرار نشد. اینترنتت رو بررسی کن.';
}

export function useAccountActions() {
  const router = useRouter();

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput): Promise<AccountUpdate> => {
      const update = await accountService.updateProfile(input);
      toast.success(
        update.xpAwarded > 0
          ? `پروفایلت کامل شد — ${toPersianDigits(update.xpAwarded)} XP گرفتی`
          : 'ذخیره شد'
      );
      router.refresh();
      return update;
    },
    [router]
  );

  /** Back to the hub, which plays the reward when this save earned one. */
  const saveAvatar = useCallback(
    async (input: AvatarInput): Promise<void> => {
      const { xpAwarded } = await accountService.saveAvatar(input);
      toast.success('آواتارت ذخیره شد');
      router.push(xpAwarded > 0 ? '/profile?reward=avatar_created' : '/profile');
      router.refresh();
    },
    [router]
  );

  const saveSettings = useCallback(
    async (input: SettingsInput): Promise<void> => {
      await accountService.saveSettings(input);
      router.refresh();
    },
    [router]
  );

  return { updateProfile, saveAvatar, saveSettings };
}
