'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminUser } from '@hamdastan/types';
import { cn } from '@hamdastan/shared/cn';
import { Button } from '@hamdastan/ui';

import { useAdminAuth } from '@/features/auth';
import { errorMessage } from '@/lib';

import { ThemeToggle } from './ThemeToggle';

/** The panel's sections. One for now; the next one is a line here and a route. */
const NAV = [{ href: '/users', label: 'مدیریت کاربران', icon: Users }] as const;

/**
 * The frame around every signed-in page: brand, the section menu, the
 * theme switch and sign-out. The current section is told by weight and a
 * neutral surface, not by the brand colour.
 */
export function AdminShell({ admin, children }: { admin: AdminUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAdminAuth();

  const signOut = async () => {
    try {
      await logout();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="min-h-dvh bg-surface-0">
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:gap-6 md:px-6">
          <Link href="/users" className="flex shrink-0 items-center gap-2 font-bold">
            <Image src="/images/brand/logo.svg" alt="" width={32} height={32} priority />
            <span className="hidden sm:inline">پنل مدیریت</span>
          </Link>

          <nav aria-label="منوی اصلی" className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const current = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                    current && 'bg-accent font-semibold text-foreground'
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {admin.firstName} {admin.lastName}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="خروج">
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
    </div>
  );
}
