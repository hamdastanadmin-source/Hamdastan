import type { AccountOverview, AccountUpdate } from '@hamdastan/types';
import type { AvatarInput, ProfileUpdateInput, SettingsInput } from '@hamdastan/validation';

import { apiClient } from './api-client';

/**
 * Every account route, named once.
 *
 * A call made while rendering on the server has no cookie jar of its own;
 * the caller passes the request's own `cookie` header through.
 */
type ServerCall = { cookie?: string };

const withCookie = (options?: ServerCall) =>
  options?.cookie ? { headers: { cookie: options.cookie } } : {};

export const accountService = {
  /** Identity, progress, missions, the social profile and settings, in one read. */
  getOverview(options?: ServerCall): Promise<AccountOverview> {
    return apiClient.get<AccountOverview>('/me/account', { ...withCookie(options), cache: 'no-store' });
  },

  updateProfile(input: ProfileUpdateInput): Promise<AccountUpdate> {
    return apiClient.patch<AccountUpdate>('/me/profile', input);
  },

  saveAvatar(input: AvatarInput): Promise<AccountUpdate> {
    return apiClient.put<AccountUpdate>('/me/avatar', input);
  },

  saveSettings(input: SettingsInput): Promise<AccountUpdate> {
    return apiClient.put<AccountUpdate>('/me/settings', input);
  },
};
