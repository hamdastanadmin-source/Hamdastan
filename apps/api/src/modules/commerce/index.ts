/**
 * Commerce — خرید و پرداخت
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { commerceRoutes } from './commerce.routes';
export { commerceService } from './commerce.service';
export { setCommerceRepository, type CommerceRepository } from './commerce.repository';
