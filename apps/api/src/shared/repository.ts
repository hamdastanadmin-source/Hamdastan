import { DataLayerNotConfiguredError } from './errors';

/**
 * The seam between business logic and storage.
 *
 * No database, ORM or client has been chosen for this project yet, and
 * nothing here assumes one. Each module declares a repository *interface* in
 * its `*.repository.ts` — its data needs, written in the language of the
 * domain — and holds it in a slot like this one.
 *
 * Services only ever call `<module>Repository()`. When a data layer is picked,
 * it supplies objects satisfying those interfaces and binds them at boot with
 * `set<Module>Repository(impl)`. No service, controller or route changes.
 *
 * Until then a call throws 501 rather than returning fake data, so an
 * unimplemented endpoint is impossible to mistake for a working one.
 */
export type RepositorySlot<T extends object> = {
  /** The bound implementation. Throws until one is registered. */
  get(): T;
  /** Binds the implementation. Called once, during boot. */
  set(implementation: T): void;
};

export function createRepositorySlot<T extends object>(
  moduleName: string
): RepositorySlot<T> {
  let implementation: T | null = null;

  return {
    get() {
      if (!implementation) throw new DataLayerNotConfiguredError(moduleName);
      return implementation;
    },
    set(next) {
      implementation = next;
    },
  };
}
