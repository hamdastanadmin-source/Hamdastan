'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { AVATAR_SLOTS, DEFAULT_AVATAR, type AvatarConfig, type AvatarSlot } from '@hamdastan/config';

import { accountErrorMessage, useAccountActions } from './use-account-actions';

/**
 * The studio's state: the outfit being tried on, and saving it.
 *
 * Choosing an item only changes the preview; nothing is stored until
 * «ذخیره». A first avatar can be saved as it stands — the default outfit is
 * a choice too — while an edit with nothing changed has nothing to save.
 */
export function useAvatarStudio(saved: AvatarConfig | null) {
  const { saveAvatar } = useAccountActions();
  const [avatar, setAvatar] = useState<AvatarConfig>(saved ?? DEFAULT_AVATAR);
  const [isSaving, setIsSaving] = useState(false);

  const changed = !saved || AVATAR_SLOTS.some((slot) => saved[slot] !== avatar[slot]);

  const choose = (slot: AvatarSlot, itemId: string) => setAvatar((current) => ({ ...current, [slot]: itemId }));

  const save = async () => {
    setIsSaving(true);
    try {
      await saveAvatar(avatar);
    } catch (error) {
      toast.error(accountErrorMessage(error));
      setIsSaving(false);
    }
  };

  return { avatar, choose, changed, isSaving, save };
}
