import type { Metadata } from 'next';

import { EventsScreen, parseDiscovery } from '@/features/events';
import { getDiscovery } from '@/features/events/server';

export const metadata: Metadata = { title: 'رویدادها' };
export const dynamic = 'force-dynamic';

export default async function EventsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const state = parseDiscovery(await searchParams);
  const { result, categories, worlds } = await getDiscovery(state);
  return <EventsScreen state={state} categories={categories} worlds={worlds} result={result} />;
}
