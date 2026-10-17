import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { EventEditor } from '@/features/events';
import { getEvent } from '@/features/events/server';

export const metadata: Metadata = { title: 'ویرایش رویداد' };

const TABS = ['basics', 'media', 'audience', 'schedule', 'venue', 'organizer', 'booking', 'publish', 'bookings'] as const;

/** `?tab=bookings` opens a tab directly — the list's «رزروها» uses it. */
export default async function EditEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // Read access is enough to open it; saving and publishing are hidden
  // without their permissions, and refused by the API.
  await requireAdminPermission('events.read');
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const event = await getEvent(id);
  const initialTab = TABS.find((t) => t === tab) ?? 'basics';
  return <EventEditor key={event.id} initial={event} initialTab={initialTab} />;
}
