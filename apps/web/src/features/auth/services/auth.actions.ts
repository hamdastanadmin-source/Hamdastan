'use server';

import { login, logout } from './session.service';
import { redirect } from 'next/navigation';

export async function loginAction(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const username = (formData.get('username') as string)?.trim();
  const password = formData.get('password') as string;

  if (!username || !password) {
    return { error: 'نام کاربری و رمز عبور الزامی است' };
  }

  const result = await login(username, password);
  if (!result.success) {
    return { error: result.error };
  }

  redirect('/');
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect('/login');
}
