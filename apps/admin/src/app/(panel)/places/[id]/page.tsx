import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { PlaceEditor } from '@/features/places';
import { getPlace } from '@/features/places/server';

export const metadata: Metadata = { title: 'ویرایش مکان' };

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  // Read access is enough to open it; changes are hidden without `worlds.manage`, and refused by the API.
  await requireAdminPermission('worlds.read');
  const { id } = await params;
  const place = await getPlace(id);
  return <PlaceEditor key={place.id} initial={place} />;
}
