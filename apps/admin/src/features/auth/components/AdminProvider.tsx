'use client';

import { createContext, type ReactNode } from 'react';
import type { AdminPrincipal } from '@hamdastan/types';

/**
 * Carries the admin resolved on the server down to the client tree, so no
 * component has to fetch the current session for itself.
 *
 * Read it with `useAdmin` from the feature's hooks. What it carries includes
 * the permission list, which is what lets the shell hide a menu — a
 * convenience, not a boundary: the backend checks again on every request.
 */
export const AdminContext = createContext<AdminPrincipal | null>(null);

export function AdminProvider({
  admin,
  children,
}: {
  admin: AdminPrincipal | null;
  children: ReactNode;
}) {
  return <AdminContext.Provider value={admin}>{children}</AdminContext.Provider>;
}
