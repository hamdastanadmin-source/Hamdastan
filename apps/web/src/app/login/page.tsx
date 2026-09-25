import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { APP_NAME } from '@hamdastan/config';

import { AuthFlow } from '@/features/auth';
import { getSession } from '@/features/auth/server';

/**
 * Entry point for `/login`. It answers one question — is anybody already
 * signed in? — and otherwise hands over to the feature.
 */

export const metadata: Metadata = {
  title: `ورود | ${APP_NAME}`,
};

/** The session is read per request, so this page can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const user = await getSession();
  if (user) {
    redirect('/');
  }

  return <AuthFlow />;
}
