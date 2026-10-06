import { UserRound } from 'lucide-react';

import type { QuestionnaireResult } from '@hamdastan/types';

import { ListGroup, ListRow } from './ListGroup';
import { PersonalityTestCard } from './PersonalityTestCard';

/**
 * «پروفایل اجتماعی من» — one row to the full result, grouped like «حساب».
 * The result itself (title, description, insights and bars) lives on
 * `/profile/social`.
 *
 * Before the questionnaire is finished, the section is the questionnaire
 * offered as a mission instead — the hub's one primary action.
 */
export function SocialProfileSection({ result }: { result: QuestionnaireResult | null }) {
  if (!result) {
    return (
      <section aria-label="پروفایل اجتماعی من">
        <PersonalityTestCard
          title="پروفایلت هنوز کامل نیست"
          body="آزمون کوتاه شخصیت رو کامل کن تا پیشنهادهای دقیق‌تری برات داشته باشیم."
        />
      </section>
    );
  }

  return (
    <ListGroup title="پروفایل اجتماعی من">
      <ListRow icon={UserRound} label="مشاهده نتیجه کامل" href="/profile/social" />
    </ListGroup>
  );
}
