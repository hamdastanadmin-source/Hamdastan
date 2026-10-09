import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  adminUsersQuerySchema,
  otpRequestSchema,
  otpVerifySchema,
  z,
} from '@hamdastan/validation';

// A malformed id would otherwise reach a `uuid` column and fail as a 500.
const userIdParams = z.object({ id: z.uuid({ error: 'شناسه معتبر نیست' }) });

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
} satisfies Record<string, unknown>;
