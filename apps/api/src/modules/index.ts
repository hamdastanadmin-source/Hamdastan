import type { FastifyPluginAsync } from 'fastify';

import { accountRoutes } from './account';
import { adminRoutes } from './admin';
import { authRoutes } from './auth';
import { commerceRoutes } from './commerce';
import { communityRoutes } from './community';
import { contentAdminRoutes, contentRoutes } from './content';
import { engagementAdminRoutes, engagementRoutes } from './engagement';
import { eventsAdminRoutes, eventsRoutes, myEventsRoutes } from './events';
import { mediaAdminRoutes, mediaRoutes } from './media';
import { missionsRoutes } from './missions';
import { notificationsAdminRoutes, notificationsRoutes } from './notifications';
import { onboardingRoutes } from './onboarding';
import { progressRoutes } from './progress';
import { searchRoutes } from './search';
import { triviaRoutes } from './trivia';
import { usersRoutes } from './users';
import { worldsAdminRoutes, worldsRoutes } from './worlds';

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
  // Engagement Studio activities, as the current user plays them.
  { prefix: '/me/activities', routes: engagementRoutes },
  // «رویدادهای من» — interest and bookings, beside the activities.
  { prefix: '/me/events', routes: myEventsRoutes },
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
  // The admin panel: its own sign-in and the admin allow-list.
  { prefix: '/admin', routes: adminRoutes },
  // Engagement Studio: designing, publishing and reviewing activities.
  { prefix: '/admin/engagement', routes: engagementAdminRoutes },
  // The media & motion library, and the files it serves to both apps.
  { prefix: '/admin/media', routes: mediaAdminRoutes },
  // Events, their categories and bookings; the world list they are filed under.
  { prefix: '/admin/events', routes: eventsAdminRoutes },
  { prefix: '/admin/worlds', routes: worldsAdminRoutes },
  // News and knowledge articles, and the index of everything filed under worlds.
  { prefix: '/admin/content', routes: contentAdminRoutes },
  // Notification campaigns: compose, target, schedule, report.
  { prefix: '/admin/notifications', routes: notificationsAdminRoutes },
  { prefix: '/media', routes: mediaRoutes },
];
