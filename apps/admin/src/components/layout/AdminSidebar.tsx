'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { ClipboardList, LayoutDashboard, Users } from 'lucide-react';

import { hasAdminPermission } from '@hamdastan/shared/rbac';
import type { AdminPermission } from '@hamdastan/types';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hamdastan/ui';

import { useAdmin } from '@/features/auth';

import { useSidebar } from './SidebarContext';

/**
 * The panel's navigation.
 *
 * Three layouts, one list: a full sidebar on a desktop, a collapsed strip of
 * icons on a tablet, and a drawer on a phone. The admin panel is a desktop
 * dashboard first — unlike `apps/web`, which is mobile-first — but it has to
 * work on a phone, so the drawer is a `Sheet` rather than a second menu.
 *
 * An item whose permission the admin lacks is left out. That is a convenience:
 * the page behind it redirects and the API behind that refuses, so hiding it
 * saves a pointless click rather than protecting anything.
 */

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Left out for an admin whose role does not carry this. */
  permission: AdminPermission;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'داشبورد', href: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  { label: 'مدیریت کاربران', href: '/users', icon: Users, permission: 'users.view' },
  {
    label: 'فرم‌ها و نظرسنجی‌ها',
    href: '/forms',
    icon: ClipboardList,
    permission: 'forms.view',
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { permissions } = useAdmin();

  const items = NAV_ITEMS.filter((item) => hasAdminPermission(permissions, item.permission));

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active = isActive(pathname, item.href);

        const content = (
          <span
            className={`flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              collapsed ? 'justify-center' : 'gap-3'
            } ${
              // The brand is navy, so `text-primary` on this near-black surface
              // is barely legible. The active item is the filled pill instead:
              // white text, and the icon inherits it through currentColor.
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <item.icon className="size-4.5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </span>
        );

        const link = (
          <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
            {content}
          </Link>
        );

        if (!collapsed) return <div key={item.href}>{link}</div>;

        return (
          <TooltipProvider key={item.href} delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              {/* rtl-ok: `side` names a physical edge; in an RTL layout the
                  sidebar sits at the right, so its tooltips open to the left. */}
              <TooltipContent side="left" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </nav>
  );
}

/**
 * The row above the navigation.
 *
 * No logo and no product name — the panel is an internal tool, and its shell
 * carries no brand lockup. The row itself stays because it is what keeps the
 * sidebar's top edge level with the header beside it; collapsed, it is empty on
 * purpose rather than filled with an initial nobody needs.
 */
function SidebarBrand({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
      {!collapsed && (
        <Link href="/" onClick={onNavigate} className="text-sm font-bold tracking-tight">
          پنل مدیریت
        </Link>
      )}
    </div>
  );
}

export function AdminSidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

  return (
    <>
      <aside
        className={`sticky top-0 z-40 hidden h-screen shrink-0 flex-col overflow-hidden border-border bg-card/60 backdrop-blur-xl transition-[width] duration-300 md:flex ${
          // rtl-ok: `border-s` is the logical inline start; the sidebar's
          // divider is on the side that faces the content in either direction.
          isCollapsed ? 'w-16' : 'w-60'
        } border-s`}
      >
        <SidebarBrand collapsed={isCollapsed} />

        <SidebarNav collapsed={isCollapsed} />
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        {/* rtl-ok: `side` names a physical edge, and the navigation drawer
            belongs at the right in an RTL layout. */}
        <SheetContent side="right" className="flex w-60 flex-col p-0">
          <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
          <SidebarBrand onNavigate={() => setMobileOpen(false)} />
          <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
