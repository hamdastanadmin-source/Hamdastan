'use client';

import { useCallback, useMemo, useState } from 'react';

import type {
  ActivityAnswerValue,
  JourneyAnswerOutcome,
  PlayerActivity,
  PlayerJourney,
  PlayerStep,
} from '@hamdastan/types';
import { answerError } from '@hamdastan/validation';

import { activitiesService } from '@/services';

import { answerMotion, playableOf, type Playable } from '../utils/journey';

export type JourneyView = 'overview' | 'cover' | 'question' | 'review' | 'dayEnd' | 'result';

/** What the day-end page reports: the API's figures, after the day's last answer. */
export type DayEndReport = { dayNumber: number; xpToday: number; journeyCompleted: boolean };

/**
 * A journey as the person plays it. Every answer goes to the API the moment
 * it is given; what comes back — the journey's new state, what was paid,
 * whether the day or the journey finished — is what the screens show. A
 * motion plays between an answer and what comes next; it never holds the
 * answer up, and a file that fails to load is simply skipped.
 */
/** How an answer reaches the API — or, in the admin's preview, a simulation of it. */
export type SendAnswer = (
  questionId: string,
  value: ActivityAnswerValue | null,
  journey: PlayerJourney
) => Promise<JourneyAnswerOutcome>;

export type JourneyPlayerOptions = {
  send?: SendAnswer;
  /** Where to open: the preview starts on any screen. */
  start?: { view: JourneyView; dayId: string | null; dayEnd?: DayEndReport };
};

export function useJourneyPlayer(activity: PlayerActivity, options: JourneyPlayerOptions = {}) {
  const [journey, setJourney] = useState<PlayerJourney>(activity.journey!);
  const [answers, setAnswers] = useState(activity.journey!.answers);
  const [source, setSource] = useState(activity);
  const [view, setView] = useState<JourneyView>(options.start?.view ?? 'overview');
  const [dayId, setDayId] = useState<string | null>(options.start?.dayId ?? null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState<ActivityAnswerValue | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [motion, setMotion] = useState<{ playable: Playable; then: () => void } | null>(null);
  const [dayEnd, setDayEnd] = useState<DayEndReport | null>(options.start?.dayEnd ?? null);
  const [media, setMedia] = useState(activity.media);

  // A refreshed page (a new day opened, another device answered) is the API's newer word.
  if (activity !== source) {
    setSource(activity);
    setJourney(activity.journey!);
    setAnswers(activity.journey!.answers);
    setMedia(activity.media);
  }

  const days = useMemo(() => new Map(activity.steps.map((step) => [step.id, step])), [activity.steps]);
  const day: PlayerStep | null = dayId ? (days.get(dayId) ?? null) : null;
  const question = day?.questions[index] ?? null;

  const firstOpen = (step: PlayerStep, given: Record<string, unknown>) => {
    const at = step.questions.findIndex((q) => !(q.id in given));
    return at === -1 ? 0 : at;
  };

  /** Opens a day: on its cover when it is to be played, as a read-back when it is finished. */
  const openDay = useCallback(
    (id: string) => {
      const state = journey.days.find((d) => d.id === id);
      if (!state || !days.has(id)) return;
      setDayId(id);
      setError(null);
      setView(state.status === 'completed' ? 'review' : 'cover');
    },
    [days, journey.days]
  );

  const startDay = useCallback(() => {
    if (!day) return;
    const at = firstOpen(day, answers);
    setIndex(at);
    setValue(undefined);
    setView('question');
  }, [answers, day]);

  const backToOverview = useCallback(() => {
    setView('overview');
    setDayId(null);
    setMotion(null);
  }, []);

  /** Plays a motion, then goes on; with nothing to play, goes on at once. */
  const play = (playable: Playable | null, then: () => void) => {
    if (playable) setMotion({ playable, then });
    else then();
  };

  const motionDone = useCallback(() => {
    const current = motion;
    setMotion(null);
    current?.then();
  }, [motion]);

  /** Applies what the API answered, and decides — from that — what comes next. */
  const advance = (outcome: JourneyAnswerOutcome, step: PlayerStep) => {
    setJourney(outcome.journey);
    setAnswers(outcome.journey.answers);
    // A result arrives with the files it shows.
    if (Object.keys(outcome.media).length) setMedia((current) => ({ ...current, ...outcome.media }));
    const fresh = outcome.journey;

    if (outcome.dayCompleted) {
      const state = fresh.days.find((d) => d.id === step.id)!;
      setDayEnd({ dayNumber: state.number, xpToday: state.xpEarned, journeyCompleted: outcome.journeyCompleted });
      const celebration = outcome.journeyCompleted ? fresh.motions.journeyComplete : fresh.motions.dayComplete;
      play(playableOf(celebration, media), () => setView('dayEnd'));
      return;
    }

    const then = () => {
      const next = step.questions.findIndex((q) => !(q.id in fresh.answers));
      if (next === -1) {
        // Every question has an answer but the day did not finish here: another device finished it.
        setView('overview');
        return;
      }
      setIndex(next);
      setValue(undefined);
    };
    // A repeat earned nothing and changed nothing: no motion for it.
    if (outcome.status === 'already_answered') then();
    else play(playableOf(answerMotion(question!, step, fresh), media), then);
  };

  /** Sends this question's answer — or, for an optional question left empty, its skip. */
  const submit = useCallback(async () => {
    if (!day || !question || busy) return;
    const problem = answerError(question, value);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const empty = value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
      const sent = empty ? null : value;
      advance(
        options.send
          ? await options.send(question.id, sent, journey)
          : await activitiesService.answer(activity.id, question.id, sent),
        day
      );
    } finally {
      setBusy(false);
    }
    // `advance` reads the latest render's state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id, busy, day, question, value, journey, options.send]);

  const changeValue = useCallback((next: ActivityAnswerValue | undefined) => {
    setError(null);
    setValue(next);
  }, []);

  const openResult = useCallback(() => {
    if (journey.result) setView('result');
  }, [journey.result]);

  return {
    journey,
    answers,
    media,
    openResult,
    view,
    day,
    dayState: day ? journey.days.find((d) => d.id === day.id) ?? null : null,
    question,
    index,
    value,
    error,
    busy,
    motion,
    dayEnd,
    openDay,
    startDay,
    backToOverview,
    submit,
    setValue: changeValue,
    motionDone,
  };
}

export type JourneyPlayerApi = ReturnType<typeof useJourneyPlayer>;
