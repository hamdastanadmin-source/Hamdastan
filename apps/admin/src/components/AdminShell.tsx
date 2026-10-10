'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, MonitorSmartphone, Sparkles, Users, type LucideIcon } from 'lucide-react';
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

import { AdminAccessProvider, useAdminAuth } from '@/features/auth';
import { can, errorMessage, homeFor, ROLE_LABELS, SECTIONS, withBasePath } from '@/lib';

import { ThemeToggle } from './ThemeToggle';

/** Each section's icon. The sections themselves, and who sees them, are `SECTIONS` in `@/lib`. */
const ICONS: Record<(typeof SECTIONS)[number]['href'], LucideIcon> = {
  '/users': Users,
  '/engagement': Sparkles,
  '/sessions': MonitorSmartphone,
};

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
          <Link href={homeFor(admin.role)} className="flex items-center gap-2 px-2 py-1.5 font-bold">
            <Image src={withBasePath('/images/brand/logo.svg')} alt="" width={32} height={32} priority />
            پنل مدیریت
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>منو</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label="منوی اصلی">
                {SECTIONS.filter((section) => can(admin.role, section.permission)).map(({ href, label }) => {
                  const Icon = ICONS[href];
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
              <span className="block text-xs">{ROLE_LABELS[admin.role]}</span>
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
            {SECTIONS.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`))?.label ?? 'پنل مدیریت'}
          </span>
        </header>
        <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
          <AdminAccessProvider role={admin.role}>{children}</AdminAccessProvider>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
