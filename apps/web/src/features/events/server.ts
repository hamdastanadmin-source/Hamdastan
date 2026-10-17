/**
 * Events — server-only surface. Kept apart from `./index` so a client
 * component cannot pull `next/headers` into its bundle.
 */

export {
  getDiscovery,
  getEventPage,
  getEventPreview,
  getMyEvents,
  getSoonEvents,
  getUpcomingEvents,
} from './services/events.server';
