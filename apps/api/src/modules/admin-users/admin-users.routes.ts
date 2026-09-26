import type { FastifyPluginAsync } from 'fastify';

import { requireAdmin } from '../../middleware/admin-guard';
import { adminUsersController } from './admin-users.controller';

/**
 * HTTP surface of the admin-users module — «مدیریت کاربران».
 *
 * Mounted at `${API_PREFIX}/admin/users` by `app.ts`. Every route is guarded,
 * and the guard names the permission the route needs:
 *
 *   GET    /                    users.view            list, searched and paged
 *   POST   /                    users.create          create + send credentials
 *   GET    /:id                 users.view            one account
 *   PATCH  /:id                 users.edit            details, role, expiry, status
 *   POST   /:id/reset-password  users.reset_password  new temporary password
 *
 * The guard is what makes the panel's hidden menus irrelevant to security: an
 * admin whose role lacks `users.view` is refused here whether or not the menu
 * was ever rendered for them. It also refuses any admin who still owes a
 * password change — see `middleware/admin-guard.ts`.
 *
 * Bodies are validated in the controller against `admin-users.schema.ts`.
 */
export const adminUsersRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', { preHandler: requireAdmin('users.view') }, adminUsersController.list);
  app.post('/', { preHandler: requireAdmin('users.create') }, adminUsersController.create);
  app.get('/:id', { preHandler: requireAdmin('users.view') }, adminUsersController.getById);
  app.patch('/:id', { preHandler: requireAdmin('users.edit') }, adminUsersController.update);
  app.post(
    '/:id/reset-password',
    { preHandler: requireAdmin('users.reset_password') },
    adminUsersController.resetPassword
  );
};
