import type { Metadata } from 'next';
import { PartyPopper } from 'lucide-react';

import { Button, IconBadge } from '@hamdastan/ui';

import { Screen, ScreenBody, ScreenFooter, ScreenHeader, ScreenTitle } from '@/components';
import { SignOutButton } from '@/features/auth';
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
      <ScreenHeader>
        <span />
        {/* The only way off this screen. Onboarding has no back — the account
            is already created and the routing table sends it straight back
            here — so without this a signed-in account is stranded on a
            placeholder. The same control the home and profile screens use. */}
        <SignOutButton />
      </ScreenHeader>
      <ScreenBody center className="items-center gap-6 text-center">
        <IconBadge size="lg" glow>
          <PartyPopper aria-hidden="true" />
        </IconBadge>

        <ScreenTitle
          title={<>خوش اومدی{user.firstName ? `، ${user.firstName}` : ''}!</>}
          description="حسابت ساخته شد. مراحل معرفی محصول به‌زودی همین‌جا اضافه می‌شن."
        />
      </ScreenBody>
      <ScreenFooter>
        <Button size="xl" className="w-full" disabled>
          به‌زودی
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
