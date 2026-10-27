/**
 * Places — مکان‌ها: a world's map, the places pinned on it and the places
 * inside those (two layers at most), each an image with its tasks.
 *
 * Public surface of the module. `modules/index.ts` mounts the two route
 * plugins; `server.ts` binds the repository. It depends on worlds,
 * engagement and media, one way each.
 */

export { placesAdminRoutes, placesRoutes } from './places.routes';
export { placesService } from './places.service';
export { setPlacesRepository, sqlPlacesRepository, type PlacesRepository } from './places.repository';
