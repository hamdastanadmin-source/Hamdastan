/**
 * Search — جستجوی سراسری
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { searchRoutes } from './search.routes';
export { searchService } from './search.service';
export { setSearchRepository, type SearchRepository } from './search.repository';
