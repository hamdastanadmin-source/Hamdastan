import { avatarSchema, profileUpdateSchema, settingsSchema } from '@hamdastan/validation';

/**
 * Request validation for the Account module.
 *
 * The same objects the edit sheets, the avatar studio and the settings
 * screen in `apps/web` are built from, Persian messages included.
 */
export const accountSchemas = {
  profile: { body: profileUpdateSchema },
  avatar: { body: avatarSchema },
  settings: { body: settingsSchema },
} satisfies Record<string, unknown>;

export type AccountSchemas = typeof accountSchemas;
