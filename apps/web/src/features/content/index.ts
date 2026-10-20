/**
 * Content — محتوا: news items and knowledge articles — their cards in a
 * world's lists and their own page.
 *
 * Public surface of the feature; the server-side reads are in `./server`.
 * Which article is live is decided by `apps/api`; this feature shows it.
 */

export { ArticleCard } from './components/ArticleCard';
export { ArticleScreen } from './components/ArticleScreen';
export { paragraphsOf } from './utils/format';
