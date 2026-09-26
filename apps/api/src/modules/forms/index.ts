/**
 * Forms & surveys — «فرم‌ها و نظرسنجی‌ها»
 *
 * Public surface of the module. `app.ts` mounts both route plugins and binds
 * the repository. Nothing outside reaches past this file.
 */

export { adminFormsRoutes, publicFormsRoutes } from './forms.routes';
export { formsService, type Respondent } from './forms.service';
export {
  setFormsRepository,
  createInMemoryFormsRepository,
  defaultFormSettings,
  type FormsRepository,
} from './forms.repository';
