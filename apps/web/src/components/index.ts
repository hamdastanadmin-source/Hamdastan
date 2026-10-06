/**
 * Components shared across this app's features but not general enough for
 * the design system — the app shell lives here.
 *
 * A component another app would also use belongs in `@hamdastan/ui`.
 * A component one feature uses belongs in that feature's `components/`.
 */

export { MobileShell } from './layout/MobileShell';
export {
  Screen,
  ScreenHeader,
  ScreenBody,
  ScreenTitle,
  ScreenFooter,
} from './layout/Screen';
export { ScreenBack } from './layout/ScreenBack';
export { BottomNav } from './layout/BottomNav';
export { XpAmount } from './xp/XpAmount';
export { RoleCharacter, type RoleCharacterFrame } from './artwork/RoleCharacter';
