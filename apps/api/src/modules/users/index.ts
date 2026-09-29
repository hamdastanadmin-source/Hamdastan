/**
 * Users — حساب کاربری و مسیر بعدی کاربر
 *
 * Public surface of the module. `app.ts` mounts the routes; `server.ts`
 * binds the repository. `nextStepFor` and `toSession` are exported because
 * the auth module answers with a session too, and both sides must compute
 * "where does this person go next" the same way — there is one function.
 */

export { usersRoutes } from './users.routes';
export { usersService, nextStepFor, toAuthUser, toSession } from './users.service';
export {
  setUsersRepository,
  sqlUsersRepository,
  type UsersRepository,
} from './users.repository';
export type { BasicInfo, OnboardingStep, UserRecord } from './users.types';
