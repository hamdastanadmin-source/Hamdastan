import type { Metadata } from 'next';

import { requireAdminPermission } from '@/features/auth/server';
import { ArticleEditor } from '@/features/content';
import { getArticle } from '@/features/content/server';

export const metadata: Metadata = { title: 'ویرایش محتوا' };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  // Read access is enough to open it; saving and publishing are hidden
  // without their permissions, and refused by the API.
  await requireAdminPermission('content.read');
  const { id } = await params;
  const article = await getArticle(id);
  return <ArticleEditor key={article.id} initial={article} />;
}
