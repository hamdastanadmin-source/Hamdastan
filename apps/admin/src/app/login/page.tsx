import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';

import { APP_NAME } from '@hamdastan/config';

import { ThemeToggle } from '@/components';
import { LoginForm } from '@/features/auth';
import { getAdminSession } from '@/features/auth/server';

export const metadata: Metadata = { title: 'ورود' };

export default async function LoginPage() {
  // Already signed in: straight to the panel. A stale cookie reads as no
  // session here, so the form shows instead of a redirect loop.
  if (await getAdminSession()) redirect('/users');

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col items-center justify-center gap-6 bg-surface-0 p-4">
      <div className="absolute top-4 end-4">
        <ThemeToggle />
      </div>
      <div className="flex items-center gap-3">
        <Image src="/images/brand/logo.svg" alt="" width={40} height={40} priority />
        <span className="text-lg font-bold">پنل مدیریت {APP_NAME}</span>
      </div>
      <LoginForm />
    </main>
  );
}
