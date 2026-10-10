/**
 * Activities — فعالیت‌ها: the surveys, missions and assessments published
 * from Engagement Studio, as the person finds and plays them.
 *
 * Public surface of the feature; the server-side reads are in `./server`.
 * Everything that decides — who may see one, whether a submission completes,
 * what it earns — is `apps/api`'s. This feature collects answers and shows
 * the answer.
 */

export { ActivitiesScreen } from './components/ActivitiesScreen';
export { ActivitiesSection } from './components/ActivitiesSection';
export { ActivityPlayer } from './components/ActivityPlayer';
