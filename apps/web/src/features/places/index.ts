/**
 * Places — مکان‌ها: a world's map (drawn at the top of its home) and the
 * places pinned on it, each an image with the places inside it and the
 * tasks done there.
 *
 * Public surface of the feature; the server-side read is in `./server`.
 * Which place is shown is decided by `apps/api`; this feature draws it.
 */

export { PlaceMap } from './components/PlaceMap';
export { PlaceScreen } from './components/PlaceScreen';
