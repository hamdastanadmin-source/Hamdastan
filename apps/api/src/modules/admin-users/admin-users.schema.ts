import {
  adminUsersQuerySchema,
  createAdminUserSchema,
  idSchema,
  updateAdminUserSchema,
  z,
} from '@hamdastan/validation';

/**
 * Request validation for admin-user management.
 *
 * Every rule here comes from `@hamdastan/validation`, which is also what the
 * create and edit forms parse against, so the two sides cannot drift. The
 * schemas normalise as well as validate — a mobile number typed as `+98 912…`
 * or `۰۹۱۲…` reaches the service as one string.
 *
 * Fastify's own `schema` option takes JSON Schema, and no zod type provider is
 * wired up, so the controller parses with these. See `docs/ARCHITECTURE.md`.
 */
export const adminUsersSchemas = {
  list: adminUsersQuerySchema,
  create: createAdminUserSchema,
  update: updateAdminUserSchema,
  /** Route params. The id is opaque to the client, so presence is the rule. */
  params: z.object({ id: idSchema }),
} satisfies Record<string, z.ZodType>;
