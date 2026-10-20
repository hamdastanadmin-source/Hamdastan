import Link from 'next/link';
import { Newspaper } from 'lucide-react';

import { ARTICLE_KIND_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import type { ArticleCard as ArticleCardData } from '@hamdastan/types';

import { MediaImage } from '@/components';

import { publishedOn } from '../utils/format';

/**
 * One article in a list — a world's tab or its home. The whole card is the
 * link, with no button inside, so a screen keeps its one primary action;
 * the picture sits at the reading start.
 */
export function ArticleCard({ card, className }: { card: ArticleCardData; className?: string }) {
  return (
    <Link
      href={`/articles/${card.slug}`}
      className={cn(
        'flex items-stretch overflow-hidden rounded-2xl border border-border bg-card outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <MediaImage id={card.imageId} alt="" fallback={<Newspaper aria-hidden="true" />} className="w-24 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <span className="text-xs text-muted-foreground">
          {ARTICLE_KIND_LABELS[card.kind]}
          {card.category && ` / ${card.category}`}
        </span>
        <span className="line-clamp-2 text-sm font-bold leading-snug">{card.title}</span>
        {card.summary && <span className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{card.summary}</span>}
        <span className="text-xs text-muted-foreground">{publishedOn(card.publishedAt)}</span>
      </span>
    </Link>
  );
}
