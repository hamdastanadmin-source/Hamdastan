/**
 * Home — صفحهٔ خانه: خوش‌آمدگویی و آزمون‌هایی که کاربر می‌تواند بدهد.
 *
 * Public surface of the feature. Nothing outside it imports past this file.
 * `/` renders `HomeScreen` and passes it the signed-in user's first name; the
 * layout of the screen is a detail of this feature.
 *
 * The quizzes are placeholders: no backend endpoint lists them yet — see the
 * note in `components/HomeScreen.tsx`. When one exists, this feature grows a
 * `services/` directory and the constant there goes away.
 */

export { HomeScreen } from './components/HomeScreen';
