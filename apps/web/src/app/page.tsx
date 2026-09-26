import { HomeScreen } from '@/features/home';
import { requireAuth } from '@/features/auth/server';

/**
 * Entry point for `/`. It resolves the session and hands over — the screen
 * itself belongs to the home feature.
 */

/** The session is read per request, so this page can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireAuth();

  return <HomeScreen firstName={user.firstName} />;
}
