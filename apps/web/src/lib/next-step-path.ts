import type { NextStep } from '@hamdastan/types';

/**
 * The page each step of the routing table lives on — the server decides the
 * step, this only names where it is. `proxy.ts` and every screen that
 * navigates on a `nextStep` read this one map.
 */
export const NEXT_STEP_PATH: Record<NextStep, string> = {
  basic_info: '/auth/basic-info',
  username: '/auth/username',
  onboarding: '/onboarding',
  home: '/',
};
