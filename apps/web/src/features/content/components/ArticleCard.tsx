import Link from 'next/link';
import { Newspaper, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react';

import { ARTICLE_KIND_LABELS } from '@hamdastan/config';
import { cn } from '@hamdastan/shared/cn';
import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ArticleCard as ArticleCardData } from '@hamdastan/types';

import { MediaImage } from '@/components';

import { publishedOn } from '../utils/format';

/** One count in the card's meta line, after a dot; read aloud as «۳ پسندیده». */
function Count({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  if (value === 0) return null;
  return (
    <>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1 tabular-nums">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {toPersianDigits(value)}
        <span className="sr-only">{label}</span>
      </span>
    </>
  );
}

/**
 * One article in a list — a world's tab or its home. The whole card is the
 * link, with no button inside, so a screen keeps its one primary action;
 * the picture sits at the reading start. Likes and dislikes follow the
 * date in the same quiet line — counts only, never a control; reacting
 * happens on the article's page. A count of zero is left out.
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
        <span className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{publishedOn(card.publishedAt)}</span>
          <Count icon={ThumbsUp} value={card.reactions.likes} label="پسندیده" />
          <Count icon={ThumbsDown} value={card.reactions.dislikes} label="نپسندیده" />
        </span>
      </span>
    </Link>
  );
}
