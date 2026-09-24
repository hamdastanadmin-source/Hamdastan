import type { FastifyPluginAsync } from 'fastify';

import { authRoutes } from './auth';
import { commerceRoutes } from './commerce';
import { communityRoutes } from './community';
import { contentRoutes } from './content';
import { eventsRoutes } from './events';
import { missionsRoutes } from './missions';
import { notificationsRoutes } from './notifications';
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
  { prefix: '/users', routes: usersRoutes },
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
