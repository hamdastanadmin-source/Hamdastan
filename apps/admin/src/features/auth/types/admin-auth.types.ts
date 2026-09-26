/**
 * Types private to the panel's sign-in screens.
 *
 * The wire contract lives in `@hamdastan/types` — what is here is the shape of
 * the screen: what went wrong, and where the message belongs.
 */

import type { AdminErrorCode } from '@hamdastan/types';

/** Which field a message belongs under, when it belongs under one. */
export type AdminAuthErrorField = 'username' | 'password' | 'newPassword' | 'confirmPassword' | 'form';

export type AdminAuthError = {
  /**
   * The backend's code where there is one, so the UI can react to it.
   *
   * `string & {}` keeps `AdminErrorCode` completing in an editor while still
   * accepting a code this build has not heard of — the backend is free to add
   * one, and the UI has to fall back rather than mis-handle it.
   */
  code?: AdminErrorCode | (string & {});
  /** Already in Persian, ready to render. */
  message: string;
  field: AdminAuthErrorField;
};
