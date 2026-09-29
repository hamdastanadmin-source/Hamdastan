import type { Metadata } from 'next';

import { Button } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader } from '@/components';
import { requireSession } from '@/features/auth/server';

export const metadata: Metadata = { title: 'شروع کار' };
export const dynamic = 'force-dynamic';

/**
 * Onboarding — a placeholder.
 *
 * The sign-in spec ends here: it says where a new account lands, not what it
 * finds. The screen exists so the routing table has a real destination and
 * the flow can be walked end to end; the steps themselves are their own piece
 * of work, and they go in `features/onboarding`.
 */
export default async function OnboardingPage() {
  const { user } = await requireSession();

  return (
    <Screen>
      <ScreenHeader />
      <ScreenBody className="flex flex-col justify-center gap-3 text-center">
        <h1 className="text-2xl font-extrabold leading-tight">
          خوش اومدی{user.firstName ? `، ${user.firstName}` : ''}!
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          آنبوردینگ هنوز ساخته نشده. این صفحه جای مراحل معرفی محصول است.
        </p>
      </ScreenBody>
      <ScreenFooter>
        <Button size="lg" className="h-12 w-full text-base font-bold" disabled>
          به‌زودی
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
