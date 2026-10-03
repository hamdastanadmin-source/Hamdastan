import { QUESTIONNAIRE_SECTIONS, type SectionId } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';

import { ScreenTitle } from '@/components';

import { QuestionnaireScreen } from './QuestionnaireScreen';
import { SectionMark } from './SectionMark';

/**
 * The beat between chapters: one line on what just happened, one on what
 * comes next, and the section mark filling its next dot. Nothing else — no
 * claim about the person yet; the result screen is the only place that
 * interprets.
 */
export function SectionReward({
  section,
  progress,
  leaving,
  onContinue,
  onBack,
}: {
  section: SectionId;
  progress: number;
  leaving: boolean;
  onContinue: () => void;
  onBack: () => void;
}) {
  const reward = QUESTIONNAIRE_SECTIONS[section - 1].reward;
  if (!reward) return null;

  return (
    <QuestionnaireScreen
      progress={progress}
      onBack={onBack}
      leaving={leaving}
      footer={
        <Button type="button" size="xl" className="w-full" onClick={onContinue}>
          {reward.cta}
        </Button>
      }
    >
      <SectionMark reached={section} />
      <ScreenTitle size="prompt" title={reward.title} description={reward.body} />
    </QuestionnaireScreen>
  );
}
