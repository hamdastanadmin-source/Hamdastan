import type { PlayerMatchingQuestion } from '@hamdastan/types';

/**
 * A matching question while it is being answered: the pairs made so far
 * (prompt id → match id) and the tile tapped first, waiting for its partner.
 * Nothing here knows the key — that stays on the server.
 */
export type MatchingSide = 'prompt' | 'match';
export type MatchingState = {
  pairs: Record<string, string>;
  pending: { side: MatchingSide; id: string } | null;
};

/** The prompt a tile belongs to, if it is paired. */
function pairedPromptOf(pairs: Record<string, string>, side: MatchingSide, id: string): string | undefined {
  if (side === 'prompt') return id in pairs ? id : undefined;
  return Object.keys(pairs).find((promptId) => pairs[promptId] === id);
}

/** The pairs a saved answer holds: one match id per prompt, in the prompts' order. */
export function matchingFromValue(question: PlayerMatchingQuestion, value: unknown): MatchingState {
  const pairs: Record<string, string> = {};
  if (Array.isArray(value)) {
    question.prompts.forEach((prompt, i) => {
      if (typeof value[i] === 'string') pairs[prompt.id] = value[i];
    });
  }
  return { pairs, pending: null };
}

/**
 * A tap on a tile. A paired tile comes apart and waits for a new partner; a
 * tile on the same side as the waiting one takes its place (or, tapped
 * again, lets go); a tile on the other side pairs with it.
 */
export function tapMatching(state: MatchingState, side: MatchingSide, id: string): MatchingState {
  const pairs = { ...state.pairs };
  const pairedPrompt = pairedPromptOf(pairs, side, id);
  if (pairedPrompt !== undefined) {
    delete pairs[pairedPrompt];
    return { pairs, pending: { side, id } };
  }

  const pending = state.pending;
  if (!pending || pending.side === side) {
    return { pairs, pending: pending?.id === id ? null : { side, id } };
  }

  if (side === 'prompt') pairs[id] = pending.id;
  else pairs[pending.id] = id;
  return { pairs, pending: null };
}

/** The answer, once every prompt has its match; until then the question is unanswered. */
export function matchingValue(question: PlayerMatchingQuestion, state: MatchingState): string[] | undefined {
  const value = question.prompts.map((prompt) => state.pairs[prompt.id]);
  return value.every((id) => id !== undefined) ? value : undefined;
}

/** A pair's number, shown on both its tiles so the person can see which went with which. */
export function pairNumber(question: PlayerMatchingQuestion, state: MatchingState, side: MatchingSide, id: string): number | null {
  const promptId = pairedPromptOf(state.pairs, side, id);
  if (promptId === undefined) return null;
  return question.prompts.findIndex((prompt) => prompt.id === promptId) + 1;
}
