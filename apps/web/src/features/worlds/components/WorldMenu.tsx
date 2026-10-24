'use client';

import { House, Sparkles } from 'lucide-react';

import type { WorldDetail } from '@hamdastan/types';

import { BottomNav } from '@/components';

import { worldActivitiesHref, worldHref } from '../utils/pages';

const ICONS = { home: House, activities: Sparkles } as const;

/**
 * A world's menu: the app's bottom bar, with the world's own items — its
 * home and «فعالیت‌ها» — in the labels the admin set. A world with only a
 * home has no menu at all. A client component because the icons are.
 */
export function WorldMenu({ world }: { world: WorldDetail }) {
  if (world.navigation.length < 2) return null;
  const items = world.navigation.map((item) => ({
    href: item.section === 'home' ? worldHref(world.slug) : worldActivitiesHref(world.slug),
    label: item.label,
    icon: ICONS[item.section],
  }));
  return <BottomNav items={items} label={`منوی ${world.name}`} />;
}
