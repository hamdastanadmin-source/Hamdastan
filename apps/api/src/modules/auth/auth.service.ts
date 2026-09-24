/**
 * Business logic for the Auth module — ورود، خروج و نشست کاربر.
 *
 * The only layer that decides anything. It knows nothing about HTTP (the
 * controller's job) and nothing about storage (the repository's job), which
 * is exactly what lets a data layer be chosen later without this file
 * changing.
 *
 *   async getById(id: string) {
 *     const found = await authRepository().findById(id);
 *     if (!found) throw new NotFoundError();
 *     return found;
 *   }
 */
export const authService = {
  // One method per use case.
};
