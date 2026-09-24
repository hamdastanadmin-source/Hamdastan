/**
 * Users — حساب کاربری و پروفایل
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { usersRoutes } from './users.routes';
export { usersService } from './users.service';
export { setUsersRepository, type UsersRepository } from './users.repository';
