'use server';

/**
 * Authentication — skeleton implementation.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ TODO: wire to a real backend.                                           │
 * │                                                                         │
 * │ There is no database or ORM in this project yet, so credentials and     │
 * │ sessions live in the in-memory stores below. That means:                │
 * │   - sessions are lost on every server restart / rebuild                 │
 * │   - they are not shared between processes, so this will not survive a   │
 * │     multi-instance deployment                                           │
 * │   - the seed credentials are in plain text                              │
 * │                                                                         │
 * │ This file is deliberately the only place that knows any of that. The    │
 * │ exported signatures are what the rest of the app depends on, so         │
 * │ swapping in a real user store means rewriting the bodies here and       │
 * │ nothing else.                                                           │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { cache } from 'react';
import type { AuthUser } from '@/types/auth';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);

/** Bypasses the login screen entirely. Handy while building UI. */
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';

const MOCK_USER: AuthUser = {
  id: 'mock-user-id',
  username: 'admin',
  fullName: 'کاربر آزمایشی',
  role: 'ADMIN',
  isActive: true,
};

// ─── In-memory stores (replace with the real data source) ────────────────────

/** Seed accounts. Passwords are plain text only because nothing is persisted. */
const USERS: ReadonlyArray<AuthUser & { password: string }> = [
  { ...MOCK_USER, password: 'admin123' },
  {
    id: 'mock-analyst-id',
    username: 'analyst',
    fullName: 'کاربر تحلیل‌گر',
    role: 'ANALYST',
    isActive: true,
    password: 'analyst123',
  },
];

type StoredSession = { userId: string; expiresAt: Date };

/**
 * Held on globalThis so the map survives the module re-evaluation that Next's
 * dev server does on every hot reload. Without this you are logged out on each
 * file save.
 */
const sessions: Map<string, StoredSession> = ((
  globalThis as typeof globalThis & {
    __hamdastanSessions?: Map<string, StoredSession>;
  }
).__hamdastanSessions ??= new Map());

/** Strips the password before the user ever leaves this module. */
function findUserById(id: string): AuthUser | null {
  const user = USERS.find((u) => u.id === id);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
  };
}

// ─── Session helpers ─────────────────────────────────────────────────────────

/** Deduplicated within a single request via React cache() */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  if (SKIP_AUTH) return MOCK_USER;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }

  const user = findUserById(session.userId);
  if (!user || !user.isActive) return null;

  return user;
});

export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    redirect('/');
  }
  return user;
}

// ─── Login / logout ──────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const user = USERS.find((u) => u.username === username);

  // Same message for "no such user" and "wrong password" so the form does not
  // leak which usernames exist.
  if (!user || !user.isActive || user.password !== password) {
    return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  );

  // Drop expired entries so the map does not grow without bound.
  const now = new Date();
  for (const [key, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(key);
  }

  sessions.set(token, { userId: user.id, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return { success: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    sessions.delete(token);
    cookieStore.delete(SESSION_COOKIE);
  }
}
