/**
 * Onboarding — علاقه‌مندی‌ها (مرحله ۱) و پرسش‌نامه اجتماعی (مرحله ۲)، و ویرایش هر دو در پنل
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts`
 * binds the repository. The scoring is exported for the tests and for a
 * future recompute job: it is a pure function of the stored answers.
 */

export { onboardingAdminRoutes, onboardingRoutes } from './onboarding.routes';
export { onboardingService, deriveQuestionnaire } from './onboarding.service';
export { computeProfile, pickRoles, resumePoint, SCORED_QUESTION_IDS } from './onboarding.scoring';
export type { SocialProfile, Role, Dimension } from './onboarding.scoring';
export { buildResult, interestGroups } from './onboarding.result';
export {
  setOnboardingRepository,
  sqlOnboardingRepository,
  type OnboardingRepository,
} from './onboarding.repository';
