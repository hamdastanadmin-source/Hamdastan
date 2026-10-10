import { CircleDot, ListChecks, SlidersHorizontal, Star, Type, type LucideIcon } from 'lucide-react';

import type { QuestionKindId } from '@hamdastan/config';

/** Each question kind's icon, in the question list and the «نوع سؤال» select. */
export const QUESTION_KIND_UI: Record<QuestionKindId, { icon: LucideIcon }> = {
  single: { icon: CircleDot },
  multiple: { icon: ListChecks },
  text: { icon: Type },
  rating: { icon: Star },
  scale: { icon: SlidersHorizontal },
};
