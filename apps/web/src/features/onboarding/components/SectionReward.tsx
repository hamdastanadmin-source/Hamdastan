import { QUESTIONNAIRE_SECTIONS, type SectionId } from '@hamdastan/config';
import { Button } from '@hamdastan/ui';

import { ScreenTitle } from '@/components';

import { QuestionnaireScreen } from './QuestionnaireScreen';
import { SectionMark } from './SectionMark';
import { StageArtwork } from './StageArtwork';

/**
 * The beat between chapters: one line on what just happened, one on what
 * comes next, and the section mark filling its next dot. Nothing else — no
 * claim about the person yet; the result screen is the only place that
 * interprets.
 *
 * Under the text, the chapter's owl, where it has one — on the same line and
 * at the same scale as the questionnaire intro's (see `StageArtwork`).
 */

/** The artwork that closes each chapter. A chapter without one shows text only. */
const REWARD_ARTWORK: Partial<Record<SectionId, string>> = {
  1: 'questionnaire-section-1',
  2: 'questionnaire-section-2',
  3: 'questionnaire-section-1',
};
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
  const artwork = REWARD_ARTWORK[section];

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
      {artwork && <StageArtwork name={artwork} />}
    </QuestionnaireScreen>
  );
}
