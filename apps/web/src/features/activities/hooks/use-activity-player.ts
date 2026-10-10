'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { ActivityAnswers, ActivityAnswerValue, ActivitySubmission, PlayerActivity } from '@hamdastan/types';
import { createIdempotencyKey } from '@hamdastan/shared';
import { answerError, validateAnswers } from '@hamdastan/validation';

import { activitiesService } from '@/services';

import { flowOf } from '../utils/activity';

export type PlayerPhase = 'intro' | 'question' | 'done';

/**
 * The player's state: where the person is, what they have answered, and
 * the submission. One question per screen; «بعدی» checks the answer with
 * the same rule the API applies and saves progress, «قبلی» steps back with
 * the answer kept. Submitting sends the answers only — whether that
 * completes the activity and what it earns is the API's answer, shown as
 * it comes back.
 */
export function useActivityPlayer(activity: PlayerActivity) {
  const flow = useMemo(() => flowOf(activity), [activity]);

  // A saved draft may predate an edit: only answers to today's questions are kept.
  const [answers, setAnswers] = useState<ActivityAnswers>(() => {
    const ids = new Set(flow.map((item) => item.question.id));
    return Object.fromEntries(Object.entries(activity.draft ?? {}).filter(([id]) => ids.has(id)));
  });
  const [phase, setPhase] = useState<PlayerPhase>('intro');
  const [index, setIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<ActivitySubmission | null>(null);
  /**
   * The key of the submission in flight, kept across a failed attempt: a
   * second tap after "no connection" may be the same submission arriving
   * twice, and the API can only tell if it carries the same key. A changed
   * answer makes it a different submission, with a key of its own.
   */
  const submissionKey = useRef<string | null>(null);

  const current = flow[index];
  const isLast = index === flow.length - 1;

  /** Starts at the first unanswered question, so a saved draft resumes where it stopped. */
  const start = useCallback(() => {
    const resume = flow.findIndex((item) => answers[item.question.id] === undefined);
    setIndex(resume === -1 ? 0 : resume);
    setError(null);
    setPhase('question');
  }, [answers, flow]);

  const setAnswer = useCallback(
    (value: ActivityAnswerValue | undefined) => {
      setError(null);
      submissionKey.current = null;
      setAnswers((previous) => {
        const next = { ...previous };
        if (value === undefined) delete next[current.question.id];
        else next[current.question.id] = value;
        return next;
      });
    },
    [current]
  );

  const back = useCallback(() => {
    setError(null);
    if (index === 0) setPhase('intro');
    else setIndex(index - 1);
  }, [index]);

  /** Sends the whole set. Throws the API's error for the screen to show. */
  const submit = useCallback(async () => {
    const checked = validateAnswers(
      flow.map((item) => item.question),
      answers
    );
    if (!checked.ok) {
      const first = flow.findIndex((item) => checked.errors[item.question.id]);
      setIndex(first);
      setError(checked.errors[flow[first].question.id]);
      return;
    }
    setSubmitting(true);
    submissionKey.current ??= createIdempotencyKey();
    try {
      setOutcome(
        await activitiesService.submit(activity.id, activity.versionId, checked.answers, submissionKey.current)
      );
      submissionKey.current = null;
      setPhase('done');
    } finally {
      setSubmitting(false);
    }
  }, [activity.id, activity.versionId, answers, flow]);

  /** Checks this answer; then the next question, or the submission. */
  const next = useCallback(async () => {
    const problem = answerError(current.question, answers[current.question.id]);
    if (problem) {
      setError(problem);
      return;
    }
    if (isLast) {
      await submit();
      return;
    }
    // Progress is saved on the way: a lost draft is an inconvenience, not
    // an error worth interrupting the person for.
    activitiesService.saveDraft(activity.id, answers).catch(() => undefined);
    setIndex(index + 1);
  }, [activity.id, answers, current, index, isLast, submit]);

  return {
    flow,
    phase,
    index,
    current,
    isLast,
    answers,
    error,
    submitting,
    outcome,
    progress: flow.length ? Math.round((index / flow.length) * 100) : 0,
    hasDraft: Object.keys(answers).length > 0,
    start,
    setAnswer,
    back,
    next,
  };
}
