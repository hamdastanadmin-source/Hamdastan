/**
 * Trivia — پرسش‌های تریویا
 *
 * Public surface of the module. `app.ts` mounts the routes; the data layer
 * binds the repository. Nothing outside reaches past this file.
 */

export { triviaRoutes } from './trivia.routes';
export { triviaService } from './trivia.service';
export { setTriviaRepository, type TriviaRepository } from './trivia.repository';
