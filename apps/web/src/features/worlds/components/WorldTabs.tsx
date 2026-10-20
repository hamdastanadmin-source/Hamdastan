import Link from 'next/link';

import { cn } from '@hamdastan/shared/cn';
import type { WorldNavItem } from '@hamdastan/types';

import { tabHref, type WorldTab } from '../utils/tabs';

/**
 * The world's menu: the tabs the admin left on, in their order and with
 * their labels. Each is an address, so a tab can be shared and reloaded.
 * The current one is told by weight and a foreground rule — never violet.
 * In a preview, the tabs are shown but not followed.
 */
export function WorldTabs({ slug, navigation, current, linked = true }: { slug: string; navigation: WorldNavItem[]; current: WorldTab; linked?: boolean }) {
  return (
    <nav aria-label="بخش‌های دنیا" className="-mx-5 overflow-x-auto border-b border-border px-5 [scrollbar-width:none]">
      <ul className="flex gap-1">
        {navigation.map((item) => {
          const active = item.section === current;
          const className = cn(
            'flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'border-foreground font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          );
          return (
            <li key={item.section}>
              {linked ? (
                <Link href={tabHref(slug, item.section)} aria-current={active ? 'page' : undefined} className={className}>
                  {item.label}
                </Link>
              ) : (
                <span className={className}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
