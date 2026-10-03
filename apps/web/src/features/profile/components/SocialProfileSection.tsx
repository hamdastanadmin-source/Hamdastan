import Link from 'next/link';

import type { QuestionnaireResult } from '@hamdastan/types';
import { Button } from '@hamdastan/ui';

import { PersonalityTestCard } from './PersonalityTestCard';
import { SectionHeading } from './SectionHeading';

/**
 * «پروفایل اجتماعی من» — the questionnaire's result, summarised: the title,
 * two lines of meaning, the three insights and the way to the full result.
 * The five bars and every internal score stay behind that link.
 *
 * Before the questionnaire is finished, the section is the questionnaire
 * offered as a mission instead.
 */
export function SocialProfileSection({
  result,
  testIsPrimary,
}: {
  result: QuestionnaireResult | null;
  /** Whether the questionnaire's action is the screen's primary one. */
  testIsPrimary: boolean;
}) {
  return (
    <section aria-labelledby="social-profile" className="flex flex-col gap-3">
      <SectionHeading id="social-profile">پروفایل اجتماعی من</SectionHeading>

      {result ? (
        <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-1.5">
            <h3 className="text-lg font-bold leading-snug">{result.title}</h3>
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{result.description}</p>
          </div>

          <dl className="flex flex-col gap-3">
            {result.insights.map((insight) => (
              <div key={insight.key} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{insight.label}</dt>
                <dd className="text-sm font-semibold">{insight.value}</dd>
              </div>
            ))}
          </dl>

          <Button asChild variant="outline" size="touch" className="w-full">
            <Link href="/profile/social">مشاهده نتیجه کامل</Link>
          </Button>
        </article>
      ) : (
        <PersonalityTestCard
          title="پروفایلت هنوز کامل نیست"
          body="آزمون کوتاه شخصیت رو کامل کن تا پیشنهادهای دقیق‌تری برات داشته باشیم."
          primary={testIsPrimary}
          headingLevel="h3"
        />
      )}
    </section>
  );
}
