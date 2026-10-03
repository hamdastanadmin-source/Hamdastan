/**
 * Onboarding — ورود اولیه کاربر: سه مرحله تا ساخت آواتار.
 *
 * Public surface of the feature. Nothing outside it imports past this file.
 *
 * Built so far: the intro screen, stage 1 (interest selection) and stage 2
 * (the social questionnaire). Answers are saved in `apps/api`; the catalog,
 * the questions and their rules live in `@hamdastan/config` and
 * `@hamdastan/validation` because the API applies them too. The
 * questionnaire's scoring is the API's alone.
 *
 * Anything a second feature starts needing moves out: shared UI to
 * `@hamdastan/ui`, shared types to `@hamdastan/types`, shared helpers to
 * `@hamdastan/shared`. See docs/ARCHITECTURE.md.
 */

export { OnboardingIntro } from './components/OnboardingIntro';
export { InterestsStep } from './components/InterestsStep';
export { QuestionnaireFlow } from './components/QuestionnaireFlow';
export { SocialProfileResult } from './components/SocialProfileResult';
