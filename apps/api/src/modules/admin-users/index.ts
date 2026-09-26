/**
 * Admin users — «مدیریت کاربران»
 *
 * Public surface of the module. `app.ts` mounts the routes and binds the
 * repository, and it owns the admin account record that `admin-auth`
 * authenticates.
 */

export { adminUsersRoutes } from './admin-users.routes';
export { adminUsersService } from './admin-users.service';
export {
  setAdminUsersRepository,
  createInMemoryAdminUsersRepository,
  createInMemoryAdminUserStore,
  seedDevelopmentAdmin,
  DEVELOPMENT_ADMIN,
  type AdminUsersRepository,
  type AdminUserStore,
} from './admin-users.repository';
export type { AdminUserRecord } from './admin-users.types';
