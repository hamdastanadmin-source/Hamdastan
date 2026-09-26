/**
 * Admin users — «مدیریت کاربران».
 *
 * Everything here is safe to import from a client component. The server-only
 * half — reading the list with the session forwarded — is exported from
 * `./server`.
 *
 * The screen is opaque on purpose: `/users` renders `UsersScreen` with the page
 * of data it fetched, and which dialogs exist, what they validate and what they
 * call stay details of this feature.
 */

export { UsersScreen } from './components/UsersScreen';
