'use client';

import { createContext, useCallback, useContext } from 'react';

import type { AdminPermission, AdminRole } from '@hamdastan/types';

import { can } from '@/lib';

const RoleContext = createContext<AdminRole | null>(null);

/** Set once, by `AdminShell`, from the session the layout read. */
export function AdminAccessProvider({ role, children }: { role: AdminRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** `can('xp.revoke')` for the signed-in admin. False outside the panel. */
export function useAdminCan(): (permission: AdminPermission) => boolean {
  const role = useContext(RoleContext);
  return useCallback((permission: AdminPermission) => (role ? can(role, permission) : false), [role]);
}
