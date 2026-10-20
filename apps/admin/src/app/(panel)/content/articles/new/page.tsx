import type { Metadata } from 'next';

import { ARTICLE_KINDS } from '@hamdastan/config';

import { requireAdminPermission } from '@/features/auth/server';
import { ArticleEditor } from '@/features/content';
import { worldIdParam } from '@/lib';

export const metadata: Metadata = { title: 'محتوای جدید' };

/** `?kind=knowledge` picks the kind; `?world=<id>` — from a world's page — files it under that world. */
export default async function NewArticlePage({ searchParams }: { searchParams: Promise<{ kind?: string; world?: string }> }) {
  await requireAdminPermission('content.write');
  const { kind, world } = await searchParams;
  return (
    <ArticleEditor
      kind={ARTICLE_KINDS.find((item) => item === kind) ?? 'news'}
      worldId={worldIdParam(world)}
    />
  );
}
