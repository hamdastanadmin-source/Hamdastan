import type { Metadata } from 'next';

import { PlaceScreen } from '@/features/places';
import { getPlace } from '@/features/places/server';

export const metadata: Metadata = { title: 'مکان' };
export const dynamic = 'force-dynamic';

/** One place of a world. The 404 page when it is not shown. */
export default async function PlacePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  return <PlaceScreen place={await getPlace(slug, id)} />;
}
