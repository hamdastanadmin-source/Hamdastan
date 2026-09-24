'use client';

import { useContext } from 'react';
import type { AuthUser } from '@hamdastan/types';

import { AuthContext } from '../components/AuthProvider';

/** For the signed-in tree. Throws if there is no user, so callers need no null check. */
export function useAuth(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error('useAuth must be used within AuthProvider with a valid user');
  }
  return user;
}

/** For components that render on both sides of the login boundary. */
export function useAuthOptional(): AuthUser | null {
  return useContext(AuthContext);
}
