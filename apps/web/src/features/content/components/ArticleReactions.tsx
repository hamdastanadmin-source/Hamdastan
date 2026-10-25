'use client';

import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { toPersianDigits } from '@hamdastan/shared/format/persian';
import type { ArticleReaction, ArticleReactions as ArticleReactionsData } from '@hamdastan/types';
import { ToggleGroup, ToggleGroupItem } from '@hamdastan/ui';

import { useArticleReaction } from '../hooks/use-article-reaction';

/** Chosen is a foreground border and a filled icon — never the brand colour. */
const ITEM_CLASS =
  'group/reaction h-10 gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 tabular-nums text-foreground hover:bg-foreground/10 hover:text-foreground data-[state=on]:border-foreground data-[state=on]:bg-foreground/10 data-[state=on]:text-foreground';

const ICON_CLASS = 'size-4 group-data-[state=on]/reaction:fill-current';

/**
 * Under an article: «پسندیدم» and «نپسندیدم», each with its count. One at a
 * time; choosing the chosen one again takes it back.
 */
export function ArticleReactions({ articleId, initial }: { articleId: string; initial: ArticleReactionsData }) {
  const { reactions, pending, react } = useArticleReaction(articleId, initial);

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">این مطلب رو دوست داشتی؟</p>
      <ToggleGroup
        type="single"
        spacing={2}
        value={reactions.mine ?? ''}
        onValueChange={(next) => react((next || null) as ArticleReaction | null)}
        disabled={pending}
        aria-label="نظرت درباره‌ی این مطلب"
      >
        <ToggleGroupItem value="like" aria-label="پسندیدم" className={ITEM_CLASS}>
          <ThumbsUp aria-hidden="true" className={ICON_CLASS} />
          {toPersianDigits(reactions.likes)}
        </ToggleGroupItem>
        <ToggleGroupItem value="dislike" aria-label="نپسندیدم" className={ITEM_CLASS}>
          <ThumbsDown aria-hidden="true" className={ICON_CLASS} />
          {toPersianDigits(reactions.dislikes)}
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
