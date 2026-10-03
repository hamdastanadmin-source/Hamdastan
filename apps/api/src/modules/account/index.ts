/**
 * Account — حساب من: هویت، آواتار، پیشرفت، ماموریت‌ها و تنظیمات
 *
 * Public surface of the module. `app.ts` mounts the routes.
 *
 * It has no repository: it composes the Users, Onboarding, Progress and
 * Missions modules, each of which owns its own data.
 */

export { accountRoutes } from './account.routes';
export { accountService } from './account.service';
