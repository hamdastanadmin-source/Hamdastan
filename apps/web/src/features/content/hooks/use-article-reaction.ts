'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import type { ArticleReaction, ArticleReactions } from '@hamdastan/types';

import { contentService, HttpError } from '@/services';

const failure = (error: unknown) =>
  error instanceof HttpError ? error.message : 'ارتباط برقرار نشد. اینترنتت رو چک کن و دوباره امتحان کن.';

/** The counts as they would be with `next` in place of the reader's current reaction. */
function withReaction(current: ArticleReactions, next: ArticleReaction | null): ArticleReactions {
  const count = (kind: ArticleReaction, total: number) => total - (current.mine === kind ? 1 : 0) + (next === kind ? 1 : 0);
  return { likes: count('like', current.likes), dislikes: count('dislike', current.dislikes), mine: next };
}

/**
 * The reader's like or dislike on an article. The change shows at once and
 * steps back if the API refuses it; the API's counts replace the guess.
 */
export function useArticleReaction(articleId: string, initial: ArticleReactions) {
  const [reactions, setReactions] = useState(initial);
  const [pending, setPending] = useState(false);

  const react = async (next: ArticleReaction | null) => {
    const before = reactions;
    setReactions(withReaction(before, next));
    setPending(true);
    try {
      setReactions(await contentService.react(articleId, next));
    } catch (error) {
      setReactions(before);
      toast.error(failure(error));
    } finally {
      setPending(false);
    }
  };

  return { reactions, pending, react };
}
