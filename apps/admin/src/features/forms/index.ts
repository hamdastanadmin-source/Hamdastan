/**
 * Forms & surveys — «فرم‌ها و نظرسنجی‌ها».
 *
 * Everything here is safe to import from a client component; the server-only
 * reads are in `./server`.
 *
 * Three screens, and they are the feature's whole surface: the dashboard, the
 * builder, and the responses. What is inside each — the palette, the canvas,
 * the rule builder, the charts — stays a detail of this feature.
 */

export { FormsScreen } from './components/FormsScreen';
export { FormBuilderScreen, type BuilderTab } from './components/builder/FormBuilderScreen';
export { ResponsesScreen } from './components/responses/ResponsesScreen';
