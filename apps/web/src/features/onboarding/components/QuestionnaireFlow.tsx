'use client';

import { useEffect, useState } from 'react';

import type { ChoiceQuestion } from '@hamdastan/config';
import type { QuestionnaireState } from '@hamdastan/types';

import { OwlLoader } from '@/components';

import { useQuestionnaire } from '../hooks/use-questionnaire';
import { progressOf, selectedCodes } from '../utils/questionnaire-flow';
import { MotivationRanking } from './MotivationRanking';
import { QuestionStep } from './QuestionStep';
import { QuestionnaireIntro } from './QuestionnaireIntro';
import { QuestionnaireResultView } from './QuestionnaireResultView';
import { SectionReward } from './SectionReward';
import { preloadSocialDnaChart } from './SocialDnaChart';

/**
 * Onboarding stage 2: the questionnaire, as one page of many short screens.
 *
 * One page rather than a URL per question, because a question's place is
 * not something to link to: a person always resumes at the first unanswered
 * question, wherever they left. `initialState` is what `apps/api` holds,
 * read on the server, so a refresh lands exactly where it should with every
 * earlier answer in place.
 *
 * This component only chooses a screen; the decisions are in
 * `useQuestionnaire` and `questionnaire-flow`.
 */
export function QuestionnaireFlow({
  initialState,
  exitHref,
}: {
  initialState: QuestionnaireState;
  /** Where the intro's back goes: the interests during onboarding, home after it. */
  exitHref: string;
}) {
  const q = useQuestionnaire(initialState);
  const { step } = q;
  const progress = progressOf(step, q.questions);
  // The owl plays on the way to the result, not when a finished person reopens it.
  const [owlDone, setOwlDone] = useState(() => step.kind === 'result');

  // The result's chart loads on demand; fetch it while the owl plays, so it
  // is there when the result is.
  useEffect(() => {
    if (step.kind === 'processing') preloadSocialDnaChart();
  }, [step.kind]);

  switch (step.kind) {
    case 'intro':
      return (
        <QuestionnaireIntro
          // Streams the first time only — not when coming back from a question.
          stream={Object.keys(q.answers).length === 0}
          backHref={exitHref}
          isLeaving={q.isSaving}
          onStart={q.start}
          onLater={() => void q.later()}
        />
      );

    case 'question':
      return (
        <QuestionStep
          // A fresh component per question, so no selection carries over.
          key={step.questionId}
          question={q.questions.find(({ id }) => id === step.questionId)!}
          isFirstSlider={step.questionId === q.questions.find(({ kind }) => kind === 'slider')?.id}
          answer={q.answers[step.questionId]}
          progress={progress}
          isSaving={q.isSaving}
          leaving={q.leaving}
          onSubmit={(answer, options) => q.submitAnswer(step.questionId, answer, options)}
          onBack={q.back}
        />
      );

    case 'rank':
      return (
        <MotivationRanking
          question={q.questions.find(({ id }) => id === step.questionId) as ChoiceQuestion}
          initialRanking={selectedCodes(q.answers[step.questionId])}
          progress={progress}
          isSaving={q.isSaving}
          leaving={q.leaving}
          onSubmit={(ranked) => void q.submitRanking(step.questionId, ranked)}
          onBack={q.back}
        />
      );

    case 'reward':
      return (
        <SectionReward
          key={step.section}
          section={step.section}
          progress={progress}
          leaving={q.leaving}
          onContinue={() => q.continueFromReward(step.section)}
          onBack={q.back}
        />
      );

    // One branch for both, so the same owl stays mounted from processing to
    // result; the result mounts once it has gone, so its own entrance plays.
    case 'processing':
    case 'result': {
      const ready = step.kind === 'result' && q.result !== null;
      return (
        <>
          {ready && owlDone && q.result && (
            <QuestionnaireResultView
              result={q.result}
              xpAwarded={q.xpAwarded}
              isLeaving={q.isSaving}
              onContinue={() => void q.finish()}
            />
          )}
          {!owlDone && <OwlLoader ready={ready} onDone={() => setOwlDone(true)} />}
        </>
      );
    }
  }
}
