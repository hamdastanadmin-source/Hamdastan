import type { AdminRole, AdminUserStatus } from '@hamdastan/types';

/**
 * Types internal to the Admin module. `AdminUser` in `@hamdastan/types` is
 * what leaves the API; this is what the repository returns.
 */

export type AdminRecord = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: AdminUserStatus;
  role: AdminRole;
  lastLoginAt: Date | null;
  createdAt: Date;
};

/** The fields a create or an edit writes, already validated. */
export type AdminFields = {
  firstName: string;
  lastName: string;
  phone: string;
  status: AdminUserStatus;
  role: AdminRole;
};

export type AdminListQuery = {
  search?: string;
  page: number;
  pageSize: number;
};
