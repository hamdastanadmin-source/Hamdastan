/**
 * Profile — حساب من: هویت، آواتار، پروفایل اجتماعی، ماموریت‌ها، پیشرفت و تنظیمات.
 *
 * Public surface of the feature. Nothing outside it imports past this file;
 * the server-only overview read is in `./server`.
 *
 * Everything shown is decided by `apps/api` — the level, the XP, what a
 * mission's status is. This feature renders it and sends the person's edits
 * back; the only choice it makes is which one action gets the primary button.
 */

export { ProfileHome } from './components/ProfileHome';
export { EditProfile } from './components/EditProfile';
export { SettingsScreen } from './components/SettingsScreen';
export { HelpScreen } from './components/HelpScreen';
export { SocialProfileScreen } from './components/SocialProfileScreen';
export { SocialProfileLoader, SocialProfilePending } from './components/SocialProfileLoader';
export { AvatarFigure } from './components/AvatarFigure';
export { PersonalityTestCard } from './components/PersonalityTestCard';
export { RewardChip } from './components/RewardChip';
