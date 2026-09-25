import {
  cancelOtpSchema,
  checkPhoneSchema,
  registerSchema,
  sendOtpSchema,
  verifyOtpSchema,
  type z,
} from '@hamdastan/validation';

/**
 * Request validation for the Auth module.
 *
 * Every rule here comes from `@hamdastan/validation`, which is also what the
 * login form parses against, so the two sides cannot drift. The schemas
 * normalise as well as validate — `+98 912…`, `۰۹۱۲…` and `0912…` all reach
 * the service as one string, so a user cannot end up with two accounts by
 * typing their number differently.
 *
 * Fastify's own `schema` option takes JSON Schema, and no zod type provider is
 * wired up, so the controller parses bodies with these. That keeps validation
 * in the HTTP layer, where it belongs, without a second source of truth.
 */
export const authSchemas = {
  checkPhone: checkPhoneSchema,
  sendOtp: sendOtpSchema,
  cancelOtp: cancelOtpSchema,
  verifyOtp: verifyOtpSchema,
  register: registerSchema,
} satisfies Record<string, z.ZodType>;
