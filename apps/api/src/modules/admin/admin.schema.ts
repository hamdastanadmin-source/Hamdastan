import {
  appUserLookupSchema,
  adminUserCreateSchema,
  adminUserUpdateSchema,
  adminUsersQuerySchema,
  otpRequestSchema,
  otpVerifySchema,
  z,
} from '@hamdastan/validation';

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const userIdParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });
const appUserParams = z.object({ userId: z.uuid({ error: 'شناسه معتبر نیست' }) });
const appSessionParams = appUserParams.extend({ sessionId: z.uuid({ error: 'شناسه معتبر نیست' }) });

/**
 * Request validation for the Admin module. The bodies are the same schemas
 * the forms in `apps/admin` parse with; only the path parameter is local.
 */

export const adminSchemas = {
  otpRequest: { body: otpRequestSchema },
  otpVerify: { body: otpVerifySchema },
  listUsers: { query: adminUsersQuerySchema },
  createUser: { body: adminUserCreateSchema },
  updateUser: { params: userIdParams, body: adminUserUpdateSchema },
  deleteUser: { params: userIdParams },
  // The number travels in a body, not a query string, so it stays out of
  // access logs.
  lookupAppUser: { body: appUserLookupSchema },
  appUserSessions: { params: appUserParams },
  revokeAppUserSession: { params: appSessionParams },
} satisfies Record<string, unknown>;
