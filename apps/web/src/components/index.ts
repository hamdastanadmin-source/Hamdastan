/**
 * Components shared across this app's features but not general enough for
 * the design system — the app shell lives here.
 *
 * A component another app would also use belongs in `@hamdastan/ui`.
 * A component one feature uses belongs in that feature's `components/`.
 */

export { Header } from './layout/Header';
export { Sidebar } from './layout/Sidebar';
export { useSidebar } from './layout/sidebar.store';
