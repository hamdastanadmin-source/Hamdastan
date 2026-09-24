/**
 * Backend boundaries for `apps/api`.
 *
 * The request path is fixed:
 *   routes -> controller -> service -> repository -> data layer
 * Each fragment below forbids one way of skipping a step. Pattern fragments —
 * see the note in `base.mjs`.
 */

/** The API is headless. */
export const backendImportPatterns = [
  {
    group: ['@hamdastan/ui', '@hamdastan/ui/*', 'react', 'react-dom'],
    message: 'The API is headless. UI packages do not belong here.',
  },
];

/** A route wires HTTP to a controller and stops there. */
export const routeLayerPatterns = [
  {
    group: ['**/*.service', '**/*.service.js', '**/*.repository', '**/*.repository.js'],
    message:
      'A route file wires HTTP to a controller. Business logic goes through the controller, not straight to the service or repository.',
  },
];

/** A controller translates HTTP to a service call and stops there. */
export const controllerLayerPatterns = [
  {
    group: ['**/*.repository', '**/*.repository.js'],
    message:
      'A controller translates HTTP to a service call. Data access belongs behind the service, in the repository.',
  },
];
