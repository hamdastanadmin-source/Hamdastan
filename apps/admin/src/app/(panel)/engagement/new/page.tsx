import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ActivityEditor } from '@/features/engagement';
import { worldIdParam } from '@/lib';

export const metadata: Metadata = { title: 'فعالیت جدید' };

/** `?world=<id>` — from a world's page — files the new activity under that world. */
export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ world?: string }> }) {
  await requireAdminPermission('activities.write');
  const { world } = await searchParams;
  return <ActivityEditor worldId={worldIdParam(world)} />;
}
