/**
 * Events — رویدادها: discovering events (list, Jalali calendar, filters),
 * an event's page with interest and booking, «رویدادهای من», and home's
 * upcoming events and reminders.
 *
 * Public surface of the feature; the server-side reads are in `./server`.
 * Who may see what is decided by `apps/api`; this feature asks and shows.
 */

export { EventCard } from './components/EventCard';
export { EventsCarousel } from './components/EventsCarousel';
export { EventDetailScreen } from './components/EventDetailScreen';
export { EventsScreen } from './components/EventsScreen';
export { MyEventsScreen } from './components/MyEventsScreen';
export { SoonEventsSection } from './components/SoonEventsSection';
export { UpcomingEventsSection } from './components/UpcomingEventsSection';
export { parseDiscovery, type DiscoveryState } from './utils/filters';
