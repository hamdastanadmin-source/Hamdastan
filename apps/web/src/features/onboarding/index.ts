/**
 * Onboarding — ورود اولیه کاربر: سه مرحله تا ساخت آواتار.
 *
 * Public surface of the feature. Nothing outside it imports past this file.
 *
 * Built so far: the intro screen and stage 1 (interest selection). Stage 1's
 * answers are saved in `apps/api` (`PUT /me/onboarding/interests`); the
 * catalog and the three-category rule live in `@hamdastan/config` and
 * `@hamdastan/validation` because the API applies them too.
 *
 * Anything a second feature starts needing moves out: shared UI to
 * `@hamdastan/ui`, shared types to `@hamdastan/types`, shared helpers to
 * `@hamdastan/shared`. See docs/ARCHITECTURE.md.
 */

export { OnboardingIntro } from './components/OnboardingIntro';
export { InterestsStep } from './components/InterestsStep';
