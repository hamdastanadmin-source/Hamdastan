'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, House, UserRound, type LucideIcon } from 'lucide-react';

import { cn } from '@hamdastan/shared/cn';

/**
 * The bar at the bottom of the top-level screens — and only those: a screen
 * one step down (edit profile, settings) has a back control instead.
 *
 * Three destinations, because three exist. A tab for a section that is not
 * built would be a promise the product cannot keep yet. A world brings its
 * own items — its home and its activities — in place of these. A tab is
 * current on its own page and the pages under it; when two match, the
 * deeper one wins, so a world's activities are not also its home.
 *
 * Sticky, like `ScreenFooter` and for the same reason: a fixed bar spans the
 * browser on a laptop instead of the column. The current tab is told apart
 * by weight and full-strength text, never by the brand colour — violet is
 * the primary action's alone.
 */

export type BottomNavItem = { href: string; label: string; icon: LucideIcon };

const ITEMS: ReadonlyArray<BottomNavItem> = [
  { href: '/', label: 'خانه', icon: House },
  { href: '/events', label: 'رویدادها', icon: CalendarDays },
  { href: '/profile', label: 'پروفایل', icon: UserRound },
];

export function BottomNav({ items = ITEMS, label = 'ناوبری اصلی' }: { items?: ReadonlyArray<BottomNavItem>; label?: string }) {
  const pathname = usePathname();
  const current = items
    .map(({ href }) => href)
    .filter((href) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <nav
      aria-label={label}
      className="sticky bottom-0 z-10 shrink-0 border-t border-border/70 bg-background/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {items.map(({ href, label: text, icon: Icon }) => {
          const active = href === current;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-2xs transition-colors',
                  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon aria-hidden="true" className="size-5" strokeWidth={active ? 2.2 : 1.8} />
                {text}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
