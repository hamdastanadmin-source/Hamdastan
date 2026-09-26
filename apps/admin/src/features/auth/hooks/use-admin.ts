'use client';

import { useContext } from 'react';

import { hasAdminPermission } from '@hamdastan/shared/rbac';
import type { AdminPermission, AdminPrincipal } from '@hamdastan/types';

import { AdminContext } from '../components/AdminProvider';

/** For the signed-in tree. Throws if there is no admin, so callers need no null check. */
export function useAdmin(): AdminPrincipal {
  const admin = useContext(AdminContext);
  if (!admin) {
    throw new Error('useAdmin must be used within AdminProvider with a valid admin');
  }
  return admin;
}

/**
 * Whether the signed-in admin may do something.
 *
 * Used to hide a menu or a button. It is not a guard: the same permission is
 * checked by `apps/api` on the route behind it, which is where the answer
 * actually matters.
 */
export function useHasPermission(permission: AdminPermission): boolean {
  return hasAdminPermission(useAdmin().permissions, permission);
}
