import type { FastifyPluginAsync } from 'fastify';

import { requireAdmin } from '../../middleware/admin-guard';
import { attachSessionUser } from '../../middleware/session-user';
import { formsController } from './forms.controller';

/**
 * HTTP surface of the Forms module — «فرم‌ها و نظرسنجی‌ها».
 *
 * Two audiences, so two plugins. Authoring is guarded by admin permissions;
 * answering is open to whoever the form's audience allows, which may be
 * everybody.
 */

/**
 * Mounted at `${API_PREFIX}/admin/forms`. Every route names the permission it
 * needs, and `requireAdmin` refuses anything else — including an admin who
 * still owes a password change.
 *
 *   GET    /overview                    forms.view             the four cards
 *   GET    /templates                   forms.view             «ساخت از الگو»
 *   GET    /                            forms.view             the dashboard
 *   POST   /                            forms.create           blank or from a template
 *   GET    /:id                         forms.view             the whole document
 *   PATCH  /:id                         forms.edit             the builder's autosave
 *   DELETE /:id                         forms.delete
 *   POST   /:id/publish|unpublish|close  forms.publish
 *   POST   /:id/duplicate               forms.create
 *   POST   /:id/assets                  forms.edit             a background image
 *   GET    /:id/responses               forms.responses.view
 *   GET    /:id/responses/stats         forms.responses.view
 *   GET    /:id/responses/export        forms.responses.export
 *   GET    /:id/responses/:responseId   forms.responses.view
 *
 * `templates` and `stats` are static segments, so Fastify matches them before
 * `/:id` and `/:responseId` — no form may be called either.
 */
export const adminFormsRoutes: FastifyPluginAsync = async (app) => {
  const view = { preHandler: requireAdmin('forms.view') };
  const edit = { preHandler: requireAdmin('forms.edit') };
  const publish = { preHandler: requireAdmin('forms.publish') };
  const create = { preHandler: requireAdmin('forms.create') };
  const readResponses = { preHandler: requireAdmin('forms.responses.view') };

  app.get('/overview', view, formsController.overview);
  app.get('/templates', view, formsController.templates);

  app.get('/', view, formsController.list);
  app.post('/', create, formsController.create);

  app.get('/:id', view, formsController.getById);
  app.patch('/:id', edit, formsController.update);
  app.delete('/:id', { preHandler: requireAdmin('forms.delete') }, formsController.remove);

  app.post('/:id/publish', publish, formsController.publish);
  app.post('/:id/unpublish', publish, formsController.unpublish);
  app.post('/:id/close', publish, formsController.close);
  app.post('/:id/duplicate', create, formsController.duplicate);
  app.post('/:id/assets', edit, formsController.uploadAsset);

  app.get('/:id/responses', readResponses, formsController.listResponses);
  app.get('/:id/responses/stats', readResponses, formsController.stats);
  app.get(
    '/:id/responses/export',
    { preHandler: requireAdmin('forms.responses.export') },
    formsController.exportResponses
  );
  app.get('/:id/responses/:responseId', readResponses, formsController.getResponse);
};

/**
 * Mounted at `${API_PREFIX}/forms` — what `apps/web` calls when somebody opens
 * a published form.
 *
 *   GET  /assets/:assetId  an uploaded background image
 *   GET  /:id              the form, if this visitor may answer it
 *   POST /:id/responses    their answers
 *
 * `attachSessionUser` says who is asking without requiring anybody: a form open
 * to everybody is answerable signed out, and one limited to an audience is
 * refused by the service rather than by the router.
 */
export const publicFormsRoutes: FastifyPluginAsync = async (app) => {
  const asVisitor = { preHandler: attachSessionUser };

  // Before `/:id`, which would otherwise swallow it.
  app.get('/assets/:assetId', formsController.getAsset);
  app.get('/:id', asVisitor, formsController.getPublished);
  app.post('/:id/responses', asVisitor, formsController.submitResponse);
};
