import Link from 'next/link';

import type { QuestionnaireResult } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { PersonalityTestCard } from './PersonalityTestCard';
import { SectionCard } from './SectionCard';

/**
 * «پروفایل اجتماعی من» — the questionnaire's result, summarised: the title,
 * two lines of meaning, the three insights as label/value rows and the way
 * to the full result. The five bars and every internal score stay behind
 * that link.
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
    <SectionCard
      id="social-profile"
      title="پروفایل اجتماعی من"
      footer={
        <Button asChild variant="outline" size="touch" className="w-full">
          <Link href="/profile/social">مشاهده نتیجه کامل</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg font-bold leading-snug">{result.title}</h3>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
        </div>

        <dl className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {result.insights.map((insight) => (
            <div key={insight.key} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-xs text-muted-foreground">{insight.label}</dt>
              <dd className="text-end text-sm font-semibold">{insight.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </SectionCard>
  );
}
