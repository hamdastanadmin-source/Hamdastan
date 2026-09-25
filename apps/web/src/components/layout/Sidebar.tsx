'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { Home, Layers, LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hamdastan/ui';
import { useSidebar } from './SidebarContext';
import { useAuth, useLogout } from '@/features/auth';

type NavItem = {
    label: string;
    href?: string;
    icon: ComponentType<{ className?: string }>;
    comingSoon?: boolean;
    secondary?: boolean;
    adminOnly?: boolean;
};

type NavGroup = {
    title: string;
    items: NavItem[];
    secondary?: boolean;
    adminOnly?: boolean;
};

// Groups and items marked `adminOnly` are filtered out for non-admins; add an
// admin section here once there are admin routes to point at.
const navGroups: NavGroup[] = [
    {
        title: 'داشبورد',
        items: [
            { label: 'خانه', href: '/', icon: Home },
        ],
    },
    {
        title: 'ابزارها',
        secondary: true,
        items: [
            { label: 'کامپوننت‌ها', href: '/components', icon: Layers, secondary: true },
        ],
    },
];

function NavItemContent({ item, isActive, collapsed }: { item: NavItem; isActive: boolean; collapsed: boolean }) {
    return (
        <div
            className={`
                flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 rounded-lg font-medium
                transition-all duration-200 group
                ${item.secondary ? 'py-1.5 text-xs' : 'py-2.5 text-sm'}
                ${item.comingSoon
                    ? 'opacity-65 cursor-not-allowed text-muted-foreground/70 bg-transparent'
                    : item.secondary
                        ? isActive
                            ? 'bg-muted/40 text-muted-foreground'
                            : 'text-muted-foreground/50 hover:text-muted-foreground/70 hover:bg-muted/30'
                        : isActive
                            ? 'bg-primary/10 text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }
            `}
        >
            <item.icon
                className={`${item.secondary ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5'} shrink-0 transition-colors ${isActive && !item.comingSoon && !item.secondary
                    ? 'text-primary'
                    : item.secondary
                        ? 'text-muted-foreground/50'
                        : 'text-muted-foreground group-hover:text-foreground'
                    }`}
            />
            {!collapsed && (
                <>
                    <span>{item.label}</span>
                    {isActive && !item.comingSoon && !item.secondary && (
                        <div className="ms-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                </>
            )}
        </div>
    );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
    const pathname = usePathname();
    const user = useAuth();
    const { logout } = useLogout();
    const isAdmin = user.role === 'ADMIN';

    // Filter groups based on role
    const visibleGroups = navGroups.filter((g) => !g.adminOnly || isAdmin);

    const primaryGroups = visibleGroups.filter(g => !g.secondary && !g.adminOnly);
    const secondaryGroups = visibleGroups.filter(g => g.secondary);
    const adminGroups = visibleGroups.filter(g => g.adminOnly);

    const renderGroup = (group: NavGroup) => (
        <div key={group.title} className={`space-y-1 ${group.secondary ? '' : 'space-y-1.5'}`}>
            {!collapsed && (
                <h3 className={`px-2 text-xs font-semibold ${group.secondary ? 'text-muted-foreground/40' : 'text-muted-foreground/70'}`}>{group.title}</h3>
            )}
            {group.items.map((item) => {
                        const isActive = !!item.href && (
                            item.href === '/'
                                ? pathname === '/'
                                : pathname === item.href || pathname.startsWith(item.href + '/')
                        );

                        const content = <NavItemContent item={item} isActive={isActive} collapsed={collapsed} />;

                        const wrappedContent = collapsed ? (
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        {!item.href || item.comingSoon ? (
                                            <div>{content}</div>
                                        ) : (
                                            <Link href={item.href} onClick={onNavigate}>
                                                {content}
                                            </Link>
                                        )}
                                    </TooltipTrigger>
                                    <TooltipContent side="left" sideOffset={8}>
                                        <span>{item.label}</span>
                                        {item.comingSoon && <span className="text-muted-foreground ms-1">(به‌زودی)</span>}
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : (
                            !item.href || item.comingSoon ? (
                                <div>{content}</div>
                            ) : (
                                <Link href={item.href} onClick={onNavigate}>
                                    {content}
                                </Link>
                            )
                        );

                        return <div key={item.label}>{wrappedContent}</div>;
                    })}
                </div>
    );

    return (
        <nav className="flex-1 px-3 py-4 flex flex-col overflow-y-auto">
            <div className="space-y-5">
                {primaryGroups.map(renderGroup)}
            </div>
            {secondaryGroups.length > 0 && (
                <div className="mt-auto pt-4 space-y-3 border-t border-border/30">
                    {secondaryGroups.map(renderGroup)}
                </div>
            )}
            {adminGroups.length > 0 && (
                <div className="pt-4 space-y-3 border-t border-border/30">
                    {adminGroups.map(renderGroup)}
                </div>
            )}
            {/* Logout button */}
            <div className="pt-3 mt-3 border-t border-border/30">
                {collapsed ? (
                    <TooltipProvider delayDuration={0}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={logout}
                                    className="flex items-center justify-center px-3 py-2 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full"
                                >
                                    <LogOut className="w-4.5 h-4.5 shrink-0" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" sideOffset={8}>
                                خروج
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full"
                    >
                        <LogOut className="w-4.5 h-4.5 shrink-0" />
                        <span>خروج</span>
                    </button>
                )}
            </div>
        </nav>
    );
}

export function Sidebar() {
    const { isCollapsed, isMobileOpen, setMobileOpen } = useSidebar();

    return (
        <>
            {/* Desktop / Tablet sidebar */}
            <aside
                className={`
                    sticky top-0 h-screen shrink-0 border-l border-border bg-card/60 backdrop-blur-xl
                    flex-col z-50 transition-[width] duration-300 ease-in-out overflow-hidden
                    hidden md:flex
                    ${isCollapsed ? 'w-16' : 'w-60'}
                `}
            >
                <div className="h-14 shrink-0 flex items-center justify-center px-5 border-b border-border">
                    <Link href="/">
                        {isCollapsed ? (
                            <Image src="/images/brand/logo.svg" alt="Logo" width={32} height={32} className="h-8 w-8 object-contain" priority />
                        ) : (
                            <Image src="/images/brand/logo.svg" alt="Logo" width={120} height={40} className="h-8 w-auto" priority />
                        )}
                    </Link>
                </div>

                <SidebarNav collapsed={isCollapsed} />

                {!isCollapsed && (
                    <div className="px-4 py-3 border-t border-border/60">
                        <p className="text-2xs text-muted-foreground/50 text-center">
                            هم‌داستان
                        </p>
                    </div>
                )}
            </aside>

            {/* Mobile Sheet drawer */}
            <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="right" className="w-60 p-0 flex flex-col">
                    <SheetTitle className="sr-only">منوی ناوبری</SheetTitle>
                    <div className="h-14 shrink-0 flex items-center justify-center px-5 border-b border-border">
                        <Link href="/" onClick={() => setMobileOpen(false)}>
                            <Image src="/images/brand/logo.svg" alt="Logo" width={120} height={40} className="h-8 w-auto" priority />
                        </Link>
                    </div>
                    <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
                    <div className="px-4 py-3 border-t border-border/60">
                        <p className="text-2xs text-muted-foreground/50 text-center">
                            هم‌داستان
                        </p>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}
