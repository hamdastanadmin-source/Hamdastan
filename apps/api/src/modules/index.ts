import type { FastifyPluginAsync } from 'fastify';

import { accountRoutes } from './account';
import { authRoutes } from './auth';
import { commerceRoutes } from './commerce';
import { communityRoutes } from './community';
import { contentRoutes } from './content';
import { eventsRoutes } from './events';
import { missionsRoutes } from './missions';
import { notificationsRoutes } from './notifications';
import { onboardingRoutes } from './onboarding';
import { progressRoutes } from './progress';
import { searchRoutes } from './search';
import { triviaRoutes } from './trivia';
import { usersRoutes } from './users';
import { worldsRoutes } from './worlds';

/**
 * The API's route table: every module and the path it answers on.
 *
 * This is the one file that has to change when a module is added, which is
 * also what makes the surface of the API readable in one screen.
 */
export const moduleRoutes: ReadonlyArray<{
  prefix: string;
  routes: FastifyPluginAsync;
}> = [
  { prefix: '/auth', routes: authRoutes },
  // The Users module answers on `/me`, not `/users` — see its routes file.
  { prefix: '', routes: usersRoutes },
  // Stage 2 of onboarding, beside stage 1's `/me/onboarding/interests`.
  { prefix: '/me/onboarding', routes: onboardingRoutes },
  // The account area — profile, avatar, settings and the hub that reads them.
  { prefix: '/me', routes: accountRoutes },
  { prefix: '/worlds', routes: worldsRoutes },
  { prefix: '/content', routes: contentRoutes },
  { prefix: '/missions', routes: missionsRoutes },
  { prefix: '/trivia', routes: triviaRoutes },
  { prefix: '/community', routes: communityRoutes },
  { prefix: '/progress', routes: progressRoutes },
  { prefix: '/events', routes: eventsRoutes },
  { prefix: '/commerce', routes: commerceRoutes },
  { prefix: '/notifications', routes: notificationsRoutes },
  { prefix: '/search', routes: searchRoutes },
];
