import { Compass, Sparkles } from 'lucide-react';

import { APP_NAME } from '@hamdastan/config';
import { Card, CardContent, IconBadge } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenHeader } from '@/components';
import { SignOutButton } from '@/features/auth';
import { requireSession } from '@/features/auth/server';

export const dynamic = 'force-dynamic';

/**
 * Home — a placeholder.
 *
 * Reached only by an account the API reports as complete. What belongs here
 * is the product; what it proves today is that the routing table ends
 * somewhere real.
 *
 * It is still written as a screen rather than as a note to the developer: a
 * signed-in user who lands on "coming soon" should see the app they signed
 * into, with their own name on it, not an unstyled paragraph.
 */
export default async function HomePage() {
  const { user } = await requireSession();

  const name = user.displayName ?? user.firstName ?? 'دوست من';
  // One glyph, from the same name shown beside it. Persian initials are read
  // as the first letter of the first word, so this is the whole rule.
  const initial = name.trim().charAt(0);

  return (
    <Screen>
      <ScreenHeader>
        <div className="flex items-center gap-3">
          {/* A span, not `Avatar`: that is a client component wrapping a
              Radix image-load state machine, and there is no image here —
              only a letter on a server-rendered page. */}
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-primary/15 text-sm font-bold text-primary"
          >
            {initial}
          </span>
          <div className="flex flex-col">
            <span className="text-2xs text-muted-foreground">خوش برگشتی</span>
            <span className="text-sm font-bold leading-tight">{name}</span>
          </div>
        </div>
        <SignOutButton />
      </ScreenHeader>

      <ScreenBody center className="gap-6">
        <Card className="border-border/60 bg-card/60">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <IconBadge glow>
              <Compass aria-hidden="true" />
            </IconBadge>

            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-extrabold leading-tight">
                حسابت آماده‌ست
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                دنیاهای {APP_NAME} هنوز باز نشدن. به‌محض این‌که اولین دنیا منتشر
                بشه، همین‌جا می‌بینیش.
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-4" />
          به‌زودی
        </p>
      </ScreenBody>
    </Screen>
  );
}
