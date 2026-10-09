'use client';

import type { ReactNode } from 'react';
import { Compass, Lightbulb, Sparkles, UserRound, Users, Zap, type LucideIcon } from 'lucide-react';

import type { QuestionnaireResult } from '@hamdastan/types';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@hamdastan/ui';
import { cn } from '@hamdastan/shared/cn';

import { RoleCharacter } from '@/components';

import { SocialDnaChart } from './SocialDnaChart';

/**
 * The social-profile report — meaning first, numbers last.
 *
 * 1. The hero: the character for the person's primary role and gender (or
 *    their avatar when there is none), whose profile this is, the title.
 * 2. The three plain-language insights, as rows of one card.
 * 3. «دنیای مورد علاقه تو»: stage 1's picks, a card per category.
 * 4. «DNA اجتماعی تو»: the seven axes as a radar with exact values.
 * 5. «این یعنی چی؟»: the readings as one short paragraph.
 *
 * The content of the questionnaire's last screen and of the profile's
 * «مشاهده نتیجه کامل» alike — one component, so the two cannot disagree.
 * Everything comes from `apps/api`, built from the person's own scores; no
 * internal code ever appears.
 */

/** One icon per insight the API sends (`onboarding.result.ts`). */
const INSIGHT_ICON: Record<string, LucideIcon> = {
  energy: Zap,
  seeking: Compass,
  structure: Users,
};

/** A section's entrance, staggered by its place on the page. */
const enter = 'animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards motion-reduce:animate-none';

function SectionHeading({ id, icon: Icon, children }: { id: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <h2 id={id} className="flex items-center gap-2 text-base font-semibold">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      {children}
    </h2>
  );
}

export function SocialProfileResult({
  result,
  eyebrow,
  avatar,
}: {
  result: QuestionnaireResult;
  /** Above the title — the line that says whose profile this is. */
  eyebrow: ReactNode;
  /** Shown only when the result has no role character: the person's avatar, or a neutral figure. */
  avatar?: ReactNode;
}) {
  const { role } = result;
  return (
    <div className="flex flex-col gap-10">
      {/* 1. Hero. */}
      <header className="flex flex-col items-center gap-4 pt-2 text-center">
        {role?.avatarId ? (
          <figure className="flex flex-col items-center gap-3">
            <RoleCharacter
              avatarId={role.avatarId}
              frame="full"
              sizes="11rem"
              priority
              className="aspect-[4/5] w-44 rounded-3xl border"
            />
            <figcaption className="text-sm text-muted-foreground">
              نقشت توی جمع: <span className="font-semibold text-foreground">{role.label}</span>
            </figcaption>
          </figure>
        ) : (
          <Avatar className="size-24 border bg-secondary">
            {avatar ?? (
              <AvatarFallback className="bg-secondary">
                <UserRound aria-hidden="true" className="size-1/2" />
              </AvatarFallback>
            )}
          </Avatar>
        )}
        <Badge variant="outline" className="font-medium text-muted-foreground">
          {eyebrow}
        </Badge>
        <h1 className="text-2xl font-bold leading-snug text-balance">{result.title}</h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty">{result.description}</p>
      </header>

      {/* 2. Insights: the label is the start of a sentence, the value its ending. */}
      {/* One card, one row per insight: three columns squeezed a sentence
          into a third of the width and broke it mid-phrase. */}
      <Card className="px-4 py-1 shadow-none">
        <dl className="flex flex-col divide-y divide-border">
          {result.insights.map((insight, index) => {
            const Icon = INSIGHT_ICON[insight.key] ?? Sparkles;
            return (
              <div
                key={insight.key}
                className={cn('flex items-center gap-3 py-3', enter)}
                style={{ animationDelay: `${150 + index * 70}ms` }}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs leading-snug text-muted-foreground">{insight.label}</dt>
                  <dd className="text-sm font-bold leading-snug">{insight.value}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </Card>

      {/* 3. Interests. */}
      {result.interests.length > 0 && (
        <section aria-labelledby="interests-heading" className="flex flex-col gap-4">
          <SectionHeading id="interests-heading" icon={Sparkles}>
            دنیای مورد علاقه تو
          </SectionHeading>
          <div className="flex flex-col gap-3">
            {result.interests.map((group) => (
              <Card key={group.key} className="shadow-none">
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <ul className="flex flex-wrap gap-2">
                    {group.interests.map((interest) => (
                      <li key={interest}>
                        <Badge variant="secondary" className="font-medium">
                          {interest}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 4. The seven axes, as one shape with its exact values. */}
      {result.dimensions.length > 0 && (
        <section aria-labelledby="dna-heading" className="flex flex-col gap-4">
          <SectionHeading id="dna-heading" icon={Compass}>
            DNA اجتماعی تو
          </SectionHeading>
          <Card className="p-5 shadow-none">
            <SocialDnaChart dimensions={result.dimensions} />
          </Card>
        </section>
      )}

      {/* 5. What it means, in plain words. */}
      <Card className="shadow-none">
        <CardHeader className="p-5 pb-2">
          <CardTitle role="heading" aria-level={2} className="flex items-center gap-2 text-base">
            <Lightbulb aria-hidden="true" className="size-4 text-muted-foreground" />
            این یعنی چی؟
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          {/* Justified: a paragraph this long reads as a block, and the last
              line still sits at the start edge. */}
          <p className="text-justify text-sm leading-7">{result.summary}</p>
        </CardContent>
      </Card>
    </div>
  );
}
