import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { EventEditor } from '@/features/events';
import { worldIdParam } from '@/lib';

export const metadata: Metadata = { title: 'رویداد جدید' };

/** `?world=<id>` — from a world's page — files the new event under that world. */
export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ world?: string }> }) {
  await requireAdminPermission('events.write');
  const { world } = await searchParams;
  return <EventEditor worldId={worldIdParam(world)} />;
}
