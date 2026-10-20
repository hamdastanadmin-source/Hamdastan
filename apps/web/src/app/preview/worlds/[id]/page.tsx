import type { Metadata } from 'next';

import { WorldPreviewScreen } from '@/features/worlds';
import { getWorldPreview } from '@/features/worlds/server';

export const metadata: Metadata = { title: 'پیش‌نمایش دنیا', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** An admin's preview of a world's home in any status, opened from the panel. Nothing it shows is recorded. */
export default async function WorldPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorldPreviewScreen home={await getWorldPreview(id)} />;
}
