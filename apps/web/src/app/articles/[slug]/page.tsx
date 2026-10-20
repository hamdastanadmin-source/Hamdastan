import type { Metadata } from 'next';

import { ArticleScreen } from '@/features/content';
import { getArticle } from '@/features/content/server';

export const metadata: Metadata = { title: 'خبر و دانستنی' };
export const dynamic = 'force-dynamic';

/** An article that is not live is the 404 page — the API answers 404, never 403. */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArticleScreen article={await getArticle(slug)} />;
}
