'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomBytes } from 'crypto';
import { cache } from 'react';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/types/auth';

const SESSION_COOKIE = 'session';
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? 7);
const BCRYPT_ROUNDS = 12;
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';

const MOCK_USER: AuthUser = {
  id: 'mock-user-id',
  username: 'admin',
  fullName: 'کاربر آزمایشی',
  role: 'ADMIN' as AuthUser['role'],
  isActive: true,
};

// ─── Session Helpers ───────────────────────────────

/** Deduplicated within a single request via React cache() */
export const getSession = cache(async (): Promise<AuthUser | null> => {
  if (SKIP_AUTH) return MOCK_USER;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.v2_Session.findUnique({
    where: { token },
    include: {
      user: {
        select: { id: true, username: true, fullName: true, role: true, isActive: true },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return session.user;
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

// ─── Login / Logout ────────────────────────────────

export async function login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.v2_User.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { success: false, error: 'نام کاربری یا رمز عبور اشتباه است' };
  }

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  // Cleanup expired sessions, create new session, update lastLogin — all independent
  await Promise.all([
    prisma.v2_Session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    prisma.v2_Session.create({ data: { userId: user.id, token, expiresAt } }),
    prisma.v2_User.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);

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
    await prisma.v2_Session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

// ─── Password Utilities ────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
