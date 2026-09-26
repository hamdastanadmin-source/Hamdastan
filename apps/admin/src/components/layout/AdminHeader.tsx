'use client';

import { usePathname } from 'next/navigation';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  ThemeToggle,
} from '@hamdastan/ui';

import { useAdmin, useAdminLogout } from '@/features/auth';

import { useSidebar } from './SidebarContext';

/**
 * The bar above the content: where you are, who you are, and the way out.
 *
 * The admin's name and role come from the session the server resolved, so the
 * header shows what the backend says the session is rather than anything the
 * browser remembered.
 */

const PAGE_TITLES: Record<string, string> = {
  '/': 'داشبورد',
  '/users': 'مدیریت کاربران',
  '/forms': 'فرم‌ها و نظرسنجی‌ها',
};

function pageTitle(pathname: string): string {
  return (
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([path]) => path !== '/' && pathname.startsWith(path))
      .sort(([a], [b]) => b.length - a.length)[0]?.[1] ??
    ''
  );
}

export function AdminHeader() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, setMobileOpen } = useSidebar();
  const admin = useAdmin();
  const { logout, isPending } = useAdminLogout();

  const initials = admin.fullName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="منوی ناوبری"
          >
            <Menu className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'باز کردن منوی کناری' : 'بستن منوی کناری'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>

          <h1 className="text-base font-bold tracking-tight sm:text-lg">
            {pageTitle(pathname)}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Separator orientation="vertical" className="hidden h-6 sm:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-muted/50">
                <div className="hidden text-start text-xs sm:block">
                  <div className="font-medium">{admin.fullName}</div>
                  <div className="text-muted-foreground">{admin.roleName}</div>
                </div>
                <Avatar className="size-9 border-2 border-background ring-1 ring-border">
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{admin.fullName}</p>
                  {/* rtl-ok: a username is Latin-only, so it reads left-to-right. */}
                  <p dir="ltr" className="text-xs text-muted-foreground">
                    {admin.username}
                  </p>
                  <Badge variant="outline" className="mt-1 w-fit gap-1">
                    <ShieldCheck className="size-3" />
                    {admin.roleName}
                  </Badge>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                disabled={isPending}
                onSelect={logout}
              >
                <LogOut className="size-4 me-2" />
                خروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
