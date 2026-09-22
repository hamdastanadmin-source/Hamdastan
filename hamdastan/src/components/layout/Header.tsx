'use client';

import { usePathname } from 'next/navigation';
import { Menu, PanelLeftClose, PanelLeftOpen, LogOut, Shield } from 'lucide-react';
import {
  Avatar, AvatarFallback, Separator, Button,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  Badge,
} from '@/components/UiComponents';
import { useSidebar } from './SidebarContext';
import { useAuth } from './AuthProvider';
import { logoutAction } from '@/actions/auth.actions';
import { ThemeToggle } from './ThemeToggle';

const PAGE_TITLES: Record<string, string> = {
  '/': 'خانه',
  '/components': 'کتابخانه کامپوننت‌ها',
};

export function Header() {
  const pathname = usePathname();
  const { isCollapsed, toggleCollapse, setMobileOpen } = useSidebar();
  const user = useAuth();

  const title =
    PAGE_TITLES[pathname] ||
    Object.entries(PAGE_TITLES)
      .filter(([path]) => path !== '/' && pathname.startsWith(path))
      .sort(([a], [b]) => b.length - a.length)[0]?.[1] ||
    '';

  const initials = user.fullName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 w-full items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="منوی ناوبری"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'باز کردن منوی کناری' : 'بستن منوی کناری'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>

          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors outline-none">
                <div className="hidden md:block text-xs text-start">
                  <div className="font-medium flex items-center gap-1.5">
                    {user.fullName}
                    {user.role === 'ADMIN' && (
                      <Badge variant="outline" className="text-2xs px-1.5 py-0 h-4 border-primary/30 text-primary">
                        مدیر
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground">{user.username}</div>
                </div>
                <Avatar className="h-9 w-9 border-2 border-background ring-1 ring-border">
                  <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.username}</p>
                  {user.role === 'ADMIN' && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <Shield className="h-3 w-3" />
                      <span>مدیر سیستم</span>
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => logoutAction()}
              >
                <LogOut className="h-4 w-4 me-2" />
                خروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
