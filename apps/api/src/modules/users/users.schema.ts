import { basicInfoSchema, z } from '@hamdastan/validation';

/**
 * Request validation for the Users module.
 *
 * `basicInfoSchema` is the same object the form in `apps/web` is built from,
 * down to the Persian error strings — importing it is what stops the two
 * sides disagreeing about what a valid name or a valid birth date is.
 */
export const usersSchemas = {
  basicInfo: { body: basicInfoSchema },
} satisfies Record<string, unknown>;

export type UsersSchemas = typeof usersSchemas;

export { z };
