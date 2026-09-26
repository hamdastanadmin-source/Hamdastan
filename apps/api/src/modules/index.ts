import type { FastifyPluginAsync } from 'fastify';

import { adminAuthRoutes } from './admin-auth';
import { adminUsersRoutes } from './admin-users';
import { authRoutes } from './auth';
import { commerceRoutes } from './commerce';
import { communityRoutes } from './community';
import { contentRoutes } from './content';
import { eventsRoutes } from './events';
import { adminFormsRoutes, publicFormsRoutes } from './forms';
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
  // The admin panel. Separate from `/auth` in every sense — its own module, its
  // own cookie, its own user store, and no way from one into the other.
  { prefix: '/admin/auth', routes: adminAuthRoutes },
  { prefix: '/admin/users', routes: adminUsersRoutes },
  { prefix: '/admin/forms', routes: adminFormsRoutes },
  // The respondent's half of the same module: open to whoever a form's
  // audience allows, which is why it is not under /admin.
  { prefix: '/forms', routes: publicFormsRoutes },
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
