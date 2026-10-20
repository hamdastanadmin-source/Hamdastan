import type { Metadata } from 'next';

import { ArticleScreen } from '@/features/content';
import { getArticlePreview } from '@/features/content/server';

export const metadata: Metadata = { title: 'پیش‌نمایش محتوا', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** An admin's preview of an article in any status, opened from the panel. Nothing it shows is recorded. */
export default async function ArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ArticleScreen article={await getArticlePreview(id)} />;
}
