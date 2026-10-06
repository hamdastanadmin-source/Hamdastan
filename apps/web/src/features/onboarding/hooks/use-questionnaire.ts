'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { QUESTIONS, type QuestionId, type SectionId } from '@hamdastan/config';
import type {
  NextStep,
  OnboardingEventInput,
  QuestionnaireAnswer,
  QuestionnaireResult,
  QuestionnaireState,
} from '@hamdastan/types';

import { HttpError, onboardingService } from '@/services';

import {
  initialStep,
  selectionCount,
  stepAfter,
  stepBefore,
  type QuestionnaireStep,
} from '../utils/questionnaire-flow';

/**
 * The questionnaire's state machine: the current screen, the saved answers,
 * and every transition between screens — each of which saves first.
 *
 * The server is the source of truth for answers and for the profile. This
 * hook keeps the answers the API last returned, never a version of its own,
 * so a back-and-edit shows exactly what is stored, and the score is rebuilt
 * on the server from scratch on every save.
 */

const PATH_FOR: Record<NextStep, string> = {
  basic_info: '/auth/basic-info',
  onboarding: '/onboarding',
  home: '/',
};

/**
 * Long enough to see the selection land. With the exit below, a tap reaches
 * the next question in about 300ms — the save runs alongside, not after.
 */
const SINGLE_CHOICE_FEEDBACK_MS = 160;
/** The outgoing screen's fade; the incoming one takes 200ms (`QuestionnaireScreen`). */
const EXIT_MS = 150;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function reportError(error: unknown) {
  // The API answers in Persian; only "never arrived" needs our wording.
  toast.error(
    error instanceof HttpError ? error.message : 'ارتباط با سرور برقرار نشد. اینترنتت رو بررسی کن.'
  );
}

/** Fire and forget: analytics never blocks or breaks the flow. */
function track(event: OnboardingEventInput) {
  onboardingService.trackEvent(event).catch(() => undefined);
}

export function useQuestionnaire(initial: QuestionnaireState) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initial.answers);
  const [step, setStep] = useState<QuestionnaireStep>(() => initialStep(initial));
  const [result, setResult] = useState<QuestionnaireResult | null>(initial.result);
  /** The XP finishing just earned; 0 when it was earned before. */
  const [xpAwarded, setXpAwarded] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  /** True for the moment the current screen is fading out. */
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  /** When the current question appeared, for `time_spent`. */
  const viewedAt = useRef(0);
  const mounted = useRef(false);

  // Arrival: a returning, unfinished person is a resume.
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (!initial.completed && Object.keys(initial.answers).length > 0) {
      track({ event: 'quiz_resumed', questionId: initial.resumeQuestionId ?? undefined });
    }
  }, [initial]);

  // Views.
  useEffect(() => {
    if (step.kind === 'question') {
      viewedAt.current = Date.now();
      track({
        event: 'quiz_question_viewed',
        questionId: step.questionId,
        sectionId: QUESTIONS[step.questionId].section,
      });
    }
    if (step.kind === 'reward') track({ event: 'quiz_section_completed', sectionId: step.section });
    if (step.kind === 'result') track({ event: 'quiz_result_viewed' });
  }, [step]);

  /**
   * Every change of screen goes through here: the current one fades out,
   * then the next one mounts and fades in. Input during the fade is ignored
   * (`leavingRef`), so a double tap cannot skip a screen.
   */
  const show = useCallback(async (next: QuestionnaireStep) => {
    if (!prefersReducedMotion()) {
      leavingRef.current = true;
      setLeaving(true);
      await wait(EXIT_MS);
    }
    setStep(next);
    setLeaving(false);
    leavingRef.current = false;
  }, []);

  const complete = useCallback(async () => {
    await show({ kind: 'processing' });
    try {
      // No minimum wait here: `OwlLoader` holds the result for one full loop.
      const state = await onboardingService.completeQuestionnaire();
      track({ event: 'quiz_section_completed', sectionId: 4 });
      track({ event: 'quiz_completed' });
      setResult(state.result);
      setXpAwarded(state.xpAwarded);
      setStep({ kind: 'result' });
    } catch (error) {
      reportError(error);
      setStep({ kind: 'question', questionId: 'Q17' });
    }
  }, [show]);

  const goTo = useCallback(
    (next: QuestionnaireStep) => {
      if (next.kind === 'processing') void complete();
      else void show(next);
    },
    [complete, show]
  );

  /**
   * Saves one answer and moves on. Returns false when the save failed, so
   * the screen keeps the person where they are with their selection intact.
   */
  const submitAnswer = useCallback(
    async (questionId: QuestionId, answer: QuestionnaireAnswer, options?: { feedback?: boolean }) => {
      setIsSaving(true);
      try {
        const [state] = await Promise.all([
          onboardingService.saveAnswer(questionId, answer),
          options?.feedback ? wait(SINGLE_CHOICE_FEEDBACK_MS) : null,
        ]);
        track({
          event: 'quiz_question_answered',
          questionId,
          sectionId: QUESTIONS[questionId].section,
          properties: {
            answerType: QUESTIONS[questionId].kind,
            timeSpentMs: Math.min(Date.now() - viewedAt.current, 3_600_000),
            selectionCount: selectionCount(answer),
          },
        });
        setAnswers(state.answers);
        goTo(stepAfter({ kind: 'question', questionId }, state.answers));
        return true;
      } catch (error) {
        reportError(error);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [goTo]
  );

  /** Q1's order of importance. Saved as Q1's answer — the ranking *is* the answer. */
  const submitRanking = useCallback(
    async (ranked: string[]) => {
      setIsSaving(true);
      try {
        const state = await onboardingService.saveAnswer('Q1', { ranked });
        setAnswers(state.answers);
        goTo(stepAfter({ kind: 'rank' }, state.answers));
      } catch (error) {
        reportError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [goTo]
  );

  const start = useCallback(() => {
    if (leavingRef.current) return;
    track({ event: 'quiz_started' });
    goTo(stepAfter({ kind: 'intro' }, answers));
  }, [answers, goTo]);

  const continueFromReward = useCallback(
    (section: SectionId) => {
      if (!leavingRef.current) goTo(stepAfter({ kind: 'reward', section }, answers));
    },
    [answers, goTo]
  );

  const back = useCallback(() => {
    const previous = stepBefore(step, answers);
    if (!previous || leavingRef.current) return;
    track({
      event: 'quiz_back_clicked',
      questionId: step.kind === 'question' ? step.questionId : undefined,
    });
    void show(previous);
  }, [answers, show, step]);

  /**
   * «بعداً انجام می‌دم», on the intro — the one place the questionnaire can be
   * put off. Once started there is no "later": the person goes to the end.
   *
   * Putting it off finishes onboarding (stage 1 is enough) and goes where
   * the server says — home, which offers the questionnaire as a mission
   * until it is done.
   */
  const later = useCallback(async () => {
    track({ event: 'quiz_abandoned' });
    setIsSaving(true);
    try {
      const { nextStep } = await onboardingService.completeOnboarding();
      router.replace(PATH_FOR[nextStep]);
      router.refresh();
    } catch (error) {
      reportError(error);
      setIsSaving(false);
    }
  }, [router]);

  /** The result's action: end onboarding and go where the server says. */
  const finish = useCallback(async () => {
    track({ event: 'quiz_result_continue_clicked' });
    setIsSaving(true);
    try {
      const { nextStep } = await onboardingService.completeOnboarding();
      router.replace(PATH_FOR[nextStep]);
      router.refresh();
    } catch (error) {
      reportError(error);
      setIsSaving(false);
    }
  }, [router]);

  return {
    step,
    answers,
    result,
    xpAwarded,
    isSaving,
    leaving,
    start,
    submitAnswer,
    submitRanking,
    continueFromReward,
    back,
    later,
    finish,
  };
}
