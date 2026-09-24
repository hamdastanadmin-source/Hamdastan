'use client';

import { createContext, type ReactNode } from 'react';
import type { AuthUser } from '@hamdastan/types';

/**
 * Carries the session resolved on the server down to the client tree, so no
 * component has to fetch the current user for itself.
 *
 * Read it with `useAuth` / `useAuthOptional` from the feature's hooks.
 */
export const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: AuthUser | null;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
