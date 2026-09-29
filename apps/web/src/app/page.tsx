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
 */
export default async function HomePage() {
  const { user } = await requireSession();

  return (
    <Screen>
      <ScreenHeader>
        <span className="text-sm font-medium text-muted-foreground">خانه</span>
        <SignOutButton />
      </ScreenHeader>
      <ScreenBody className="flex flex-col justify-center gap-3 text-center">
        <h1 className="text-2xl font-extrabold leading-tight">
          سلام {user.displayName ?? user.firstName ?? 'دوست من'}!
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          حسابت کامله. از این‌جا به بعد، محتوای محصول می‌آید.
        </p>
      </ScreenBody>
    </Screen>
  );
}
