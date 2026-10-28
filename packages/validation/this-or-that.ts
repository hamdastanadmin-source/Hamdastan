/**
 * «این یا اون» — the rule a run of matches is read by, written once: the
 * player replays a saved draft with it, and the API checks a draft and a
 * submission with it.
 *
 * Given the cards in the person's order, match 1 is the first card against
 * the second, and match n the winner of match n − 1 against card n + 1. The
 * answers keep each match under its number, as `[winner, loser]` — so a
 * stored response says, on its own, who met whom, in what order, and who won.
 */

import type { ActivityAnswers } from '@hamdastan/types';

/**
 * The winners of the matches played, in order — or null when the answers
 * are not a run of matches over these cards from the first one.
 */
export function thisOrThatWinners(cardIds: readonly string[], answers: ActivityAnswers): string[] | null {
  const played = Object.keys(answers).length;
  if (played > Math.max(0, cardIds.length - 1)) return null;

  const winners: string[] = [];
  let champion = cardIds[0];
  for (let match = 1; match <= played; match++) {
    const value = answers[String(match)];
    const challenger = cardIds[match];
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [winner, loser] = value;
    const pair = new Set([winner, loser]);
    if (winner === loser || !pair.has(champion) || !pair.has(challenger)) return null;
    winners.push(winner);
    champion = winner;
  }
  return winners;
}

/** The answers for these winners, in order: `{ "1": [winner, loser], … }`. */
export function thisOrThatAnswers(cardIds: readonly string[], winners: readonly string[]): ActivityAnswers {
  let champion = cardIds[0];
  return Object.fromEntries(
    winners.map((winner, i) => {
      const loser = winner === champion ? cardIds[i + 1] : champion;
      champion = winner;
      return [String(i + 1), [winner, loser]];
    })
  );
}
