'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Sparkles, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { AdminUser } from '@hamdastan/types';
import {
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@hamdastan/ui';

import { useAdminAuth } from '@/features/auth';
import { errorMessage } from '@/lib';

import { ThemeToggle } from './ThemeToggle';

/** The panel's sections. A new one is a line here and a route under `(panel)/`. */
const NAV = [
  { href: '/users', label: 'مدیریت کاربران', icon: Users },
  { href: '/engagement', label: 'استودیو', icon: Sparkles },
] as const;

/**
 * The frame around every signed-in page: a dashboard with the menu in a
 * shadcn `Sidebar` at the reading start — the right, in RTL — and the page
 * beside it. On a phone the same menu opens as a sheet from the right, from
 * the trigger in the top bar; on a laptop the trigger (or Ctrl/⌘+B) folds it
 * away.
 *
 * The current section is told by weight and a neutral surface, never by the
 * brand colour — the sidebar's tokens alias the neutral surfaces.
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
    <SidebarProvider>
      {/* rtl-ok: `side` names the physical edge; in RTL the reading start is the right. */}
      <Sidebar side="right" collapsible="offcanvas">
        <SidebarHeader>
          <Link href="/users" className="flex items-center gap-2 px-2 py-1.5 font-bold">
            <Image src="/images/brand/logo.svg" alt="" width={32} height={32} priority />
            پنل مدیریت
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>منو</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label="منوی اصلی">
                {NAV.map(({ href, label, icon: Icon }) => {
                  const current = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <SidebarMenuItem key={href}>
                      <SidebarMenuButton asChild isActive={current}>
                        <Link href={href} aria-current={current ? 'page' : undefined}>
                          <Icon aria-hidden="true" />
                          <span>{label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="flex items-center gap-1 px-2">
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {admin.firstName} {admin.lastName}
            </span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="خروج">
              <LogOut aria-hidden="true" />
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* `min-w-0`: a flex item would otherwise grow to fit a wide table and
          push the page sideways; with it, the table scrolls inside its card. */}
      <SidebarInset className="min-w-0 bg-surface-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background px-4 md:px-6">
          <SidebarTrigger />
          <span className="text-sm font-semibold">
            {NAV.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.label ?? 'پنل مدیریت'}
          </span>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
