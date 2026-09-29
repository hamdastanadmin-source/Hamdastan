import { basicInfoSchema, otpRequestSchema, otpVerifySchema, z } from '@hamdastan/validation';

/**
 * Request validation for the Auth module.
 *
 * Every rule is imported rather than restated: these are the same schemas the
 * form in `apps/web` parses against, so a value the browser accepted cannot
 * be one the API rejects for a different reason — or, worse, the other way
 * round.
 */
export const authSchemas = {
  otpRequest: { body: otpRequestSchema },
  otpVerify: { body: otpVerifySchema },
  basicInfo: { body: basicInfoSchema },
} satisfies Record<string, unknown>;

export type AuthSchemas = typeof authSchemas;

export { z };
