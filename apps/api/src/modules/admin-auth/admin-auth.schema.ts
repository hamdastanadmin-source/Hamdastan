import {
  adminChangePasswordSchema,
  adminLoginSchema,
  type z,
} from '@hamdastan/validation';

/**
 * Request validation for the admin-auth module.
 *
 * Both schemas come from `@hamdastan/validation`, which is also what the login
 * and change-password forms parse against, so a rule cannot hold on one side
 * and not the other. The password policy in particular is defined once there:
 * the form shows which rule is unmet, and this is where it is decided.
 *
 * Note what the login schema deliberately does **not** do: it does not apply
 * the policy to the password field. A temporary password does not satisfy the
 * policy, and rejecting it at the door would lock every new admin out before
 * they could reach the change-password screen.
 */
export const adminAuthSchemas = {
  login: adminLoginSchema,
  changePassword: adminChangePasswordSchema,
} satisfies Record<string, z.ZodType>;
