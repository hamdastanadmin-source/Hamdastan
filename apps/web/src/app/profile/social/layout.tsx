import type { ReactNode } from 'react';

import { SocialProfileLoader } from '@/features/profile';

/** The owl plays over the result while it loads; see `SocialProfileLoader`. */
export default function SocialProfileLayout({ children }: { children: ReactNode }) {
  return <SocialProfileLoader>{children}</SocialProfileLoader>;
}
