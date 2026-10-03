import { Screen, ScreenBody, ScreenHeader, ScreenTitle } from '@/components';

import { SectionMark } from './SectionMark';

/**
 * While the API finishes the questionnaire — under a second. No spinner and
 * no pretend analysis: the last dot of the section mark fills, which is the
 * fourth chapter closing, and the result follows.
 */
export function QuestionnaireProcessing() {
  return (
    <Screen className="bg-surface-stage">
      <ScreenHeader />
      <ScreenBody center className="gap-5">
        <SectionMark reached={4} />
        <div role="status" aria-live="polite">
          <ScreenTitle
            size="prompt"
            title="داریم پروفایلت رو می‌سازیم"
            description="جواب‌هات رو کنار هم می‌ذاریم."
          />
        </div>
      </ScreenBody>
    </Screen>
  );
}
