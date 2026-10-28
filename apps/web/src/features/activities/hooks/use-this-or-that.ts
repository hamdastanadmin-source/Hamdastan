'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createIdempotencyKey } from '@hamdastan/shared';
import type { ActivitySubmission, PlayerActivity } from '@hamdastan/types';
import { useReducedMotion } from '@hamdastan/ui';
import { thisOrThatAnswers, thisOrThatWinners } from '@hamdastan/validation';

import { activitiesService } from '@/services';

import { duelPair } from '../utils/this-or-that';

export type DuelPhase = 'intro' | 'play' | 'final';

/** How long a pick is shown — the winner lifted, the loser leaving — before the next card comes in. */
const PICK_MS = 450;

/**
 * «این یا اون»'s state: the picks so far, the two cards on screen, and the
 * submission. Every pick is saved as the draft, so leaving and coming back
 * resumes the same run; «قبلی» takes the last pick back. The order of the
 * cards, and whether the run counts, are the API's.
 */
export function useThisOrThat(activity: PlayerActivity) {
  const still = useReducedMotion();
  const cards = useMemo(() => activity.thisOrThat?.cards ?? [], [activity.thisOrThat]);
  const ids = useMemo(() => cards.map((card) => card.id), [cards]);
  const rounds = Math.max(0, cards.length - 1);

  // A draft saved against another version replays to nothing, and the run starts over.
  const [winners, setWinners] = useState<string[]>(() => thisOrThatWinners(ids, activity.draft ?? {}) ?? []);
  const [phase, setPhase] = useState<DuelPhase>('intro');
  const [picked, setPicked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<ActivitySubmission | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** As in `useActivityPlayer`: kept across a failed attempt, so a retry is the same submission. */
  const submissionKey = useRef<string | null>(null);

  const pair = duelPair(cards, winners);
  const winner = pair ? null : (cards.find((card) => card.id === winners.at(-1)) ?? null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // The card after the next comes in without a wait: its image is fetched while this pick is made.
  useEffect(() => {
    const upcoming = cards[winners.length + 2];
    const media = upcoming && activity.media[upcoming.imageId];
    if (media) new Image().src = activitiesService.mediaUrl(media);
  }, [activity.media, cards, winners.length]);

  // A lost draft is an inconvenience, not an error worth interrupting the game for.
  const save = useCallback(
    (next: string[]) => {
      submissionKey.current = null;
      activitiesService.saveDraft(activity.id, thisOrThatAnswers(ids, next)).catch(() => undefined);
    },
    [activity.id, ids]
  );

  /** The participation's start is recorded on the server; a run already played to the end opens on its pick. */
  const start = useCallback(() => {
    void activitiesService.start(activity.id).catch(() => undefined);
    setPhase(winners.length === rounds ? 'final' : 'play');
  }, [activity.id, rounds, winners.length]);

  const pick = useCallback(
    (id: string) => {
      if (picked || !pair) return;
      setPicked(id);
      timer.current = setTimeout(
        () => {
          const next = [...winners, id];
          setWinners(next);
          setPicked(null);
          save(next);
          if (next.length === rounds) setPhase('final');
        },
        still ? 0 : PICK_MS
      );
    },
    [pair, picked, rounds, save, still, winners]
  );

  /** One pick back — from the final card, too — or, before the first, the intro. */
  const back = useCallback(() => {
    if (picked || outcome) return;
    if (winners.length === 0) {
      setPhase('intro');
      return;
    }
    const next = winners.slice(0, -1);
    setWinners(next);
    save(next);
    setPhase('play');
  }, [outcome, picked, save, winners]);

  /** Sends the run. Throws the API's error for the screen to show. */
  const finish = useCallback(async () => {
    setSubmitting(true);
    submissionKey.current ??= createIdempotencyKey();
    try {
      setOutcome(
        await activitiesService.submit(activity.id, activity.versionId, thisOrThatAnswers(ids, winners), submissionKey.current)
      );
      submissionKey.current = null;
    } finally {
      setSubmitting(false);
    }
  }, [activity.id, activity.versionId, ids, winners]);

  return {
    cards,
    phase,
    pair,
    winner,
    picked,
    round: winners.length + 1,
    rounds,
    progress: rounds ? Math.round((winners.length / rounds) * 100) : 0,
    hasDraft: winners.length > 0,
    submitting,
    outcome,
    start,
    pick,
    back,
    finish,
  };
}
